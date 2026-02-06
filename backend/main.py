"""
OpenLCA 2.6.0 Sankey Plugin Backend

Uses the native get_sankey_graph() API exposed by openLCA >= 2.2.
This replaces the old manual contribution-based approach used in openLCA 2.0.
"""

import sys
import time
import logging

try:
    import olca_ipc as olca
    import olca_schema as schema
except ImportError:
    print("Error: 'olca_ipc' module not found. Install with: pip install -U olca-ipc")
    sys.exit(1)

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sankey-backend")

app = FastAPI(title="OpenLCA Sankey Plugin", version="2.6.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = None


def get_client():
    """Get or create the IPC client connection to openLCA."""
    global client
    if client is None:
        try:
            client = olca.Client(8080)
            log.info("Connected to openLCA IPC on port 8080")
        except Exception as e:
            log.error(f"Failed to connect to openLCA: {e}")
            return None
    return client


@app.get("/api/status")
def get_status():
    """Check connection status to openLCA."""
    cl = get_client()
    if cl:
        return {"status": "connected", "version": "2.6.0"}
    else:
        return {"status": "disconnected"}


@app.get("/api/descriptors/{model_type}")
def get_descriptors(model_type: str):
    """Get descriptors for a given model type."""
    cl = get_client()
    if not cl:
        raise HTTPException(status_code=503, detail="openLCA not connected")

    type_map = {
        "ProductSystem": schema.ProductSystem,
        "ImpactCategory": schema.ImpactCategory,
        "ImpactMethod": schema.ImpactMethod,
        "Process": schema.Process,
        "Flow": schema.Flow,
    }

    schema_type = type_map.get(model_type)
    if not schema_type:
        return []

    try:
        descriptors = cl.get_descriptors(schema_type)
        return [d.to_dict() for d in descriptors]
    except Exception as e:
        log.exception("Error fetching descriptors")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/method/{method_id}/categories")
def get_method_categories(method_id: str):
    """Get impact categories for a specific impact method, including ref_unit."""
    cl = get_client()
    if not cl:
        raise HTTPException(status_code=503, detail="openLCA not connected")

    try:
        method = cl.get(schema.ImpactMethod, method_id)
        if not method:
            return []

        categories = []
        if method.impact_categories:
            for cat_ref in method.impact_categories:
                # Fetch full impact category to get ref_unit
                ref_unit = ""
                try:
                    full_cat = cl.get(schema.ImpactCategory, cat_ref.id)
                    if full_cat and full_cat.ref_unit:
                        ref_unit = full_cat.ref_unit
                except Exception:
                    pass
                categories.append({
                    "@id": cat_ref.id,
                    "name": cat_ref.name,
                    "refUnit": ref_unit,
                })
        return categories
    except Exception as e:
        log.exception("Error fetching method categories")
        raise HTTPException(status_code=500, detail=str(e))


def _empty_result():
    return {
        "nodes": [],
        "links": [],
        "totalImpact": 0,
        "impactUnit": "",
        "impactCategory": "",
        "rootIndex": 0,
    }


def _wait_for_result(result, max_wait: int = 120):
    """Block until the calculation result is ready."""
    waited = 0.0
    while waited < max_wait:
        state = result.get_state()
        if state.is_ready:
            log.info(f"Calculation ready after {waited:.1f}s")
            return
        if state.error:
            raise HTTPException(
                status_code=500,
                detail=f"Calculation error: {state.error}",
            )
        time.sleep(0.5)
        waited += 0.5
    raise HTTPException(status_code=504, detail="Calculation timed out")


def _resolve_impact_category(result, impact_cats, impact_category_id):
    """Find the target impact category — user-selected or auto-selected by largest impact."""
    if impact_category_id:
        for cat in impact_cats:
            if cat.id == impact_category_id:
                return cat

    # Auto-select: find the category with the largest absolute total impact
    total_impacts_list = result.get_total_impacts()
    impacts_by_id = {}
    for ti in total_impacts_list:
        if ti.impact_category:
            impacts_by_id[ti.impact_category.id] = ti.amount or 0.0

    best_cat = None
    best_amount = 0.0
    for cat in impact_cats:
        amount = abs(impacts_by_id.get(cat.id, 0.0))
        if amount > best_amount:
            best_amount = amount
            best_cat = cat

    if best_cat:
        log.info(f"Auto-selected impact category: {best_cat.name} (impact={best_amount})")
        return best_cat

    return impact_cats[0] if impact_cats else None


def _get_ref_unit(cl, impact_ref) -> str:
    """Get the reference unit for an impact category."""
    try:
        full_cat = cl.get(schema.ImpactCategory, impact_ref.id)
        if full_cat and full_cat.ref_unit:
            return full_cat.ref_unit
    except Exception:
        pass
    return ""


@app.get("/api/sankey/{system_id}")
def get_sankey(
    system_id: str,
    impact_method_id: Optional[str] = Query(None),
    impact_category_id: Optional[str] = Query(None),
    max_nodes: int = Query(25),
    min_share: float = Query(0.0),
):
    """
    Get Sankey diagram data using the native get_sankey_graph() API.

    This uses openLCA's built-in Sankey graph computation which performs
    a proper upstream traversal of the product system, producing accurate
    direct and total results per node and upstream share per edge.
    """
    cl = get_client()
    if not cl:
        raise HTTPException(status_code=503, detail="openLCA not connected")

    try:
        # Load product system
        system = cl.get(schema.ProductSystem, system_id)
        if not system:
            raise HTTPException(status_code=404, detail="Product system not found")

        log.info(f"Calculating Sankey for: {system.name}")

        # Resolve impact method
        impact_methods = cl.get_descriptors(schema.ImpactMethod)
        if not impact_methods:
            log.warning("No impact methods found in database")
            return _empty_result()

        method_ref = None
        if impact_method_id:
            for m in impact_methods:
                if m.id == impact_method_id:
                    method_ref = schema.Ref(id=m.id, name=m.name)
                    break
        if not method_ref:
            method_ref = schema.Ref(id=impact_methods[0].id, name=impact_methods[0].name)

        log.info(f"Using impact method: {method_ref.name}")

        # Setup calculation
        setup = schema.CalculationSetup(
            target=system.to_ref(),
            impact_method=method_ref,
            amount=system.target_amount or 1.0,
        )

        # Run calculation
        result = cl.calculate(setup)
        if result.error:
            log.error(f"Calculation error: {result.error}")
            return _empty_result()

        _wait_for_result(result)

        # Get impact categories from result
        impact_cats = result.get_impact_categories()
        if not impact_cats:
            log.warning("No impact categories in result")
            result.dispose()
            return _empty_result()

        # Resolve target impact category
        target_impact = _resolve_impact_category(
            result, impact_cats, impact_category_id
        )
        if not target_impact:
            result.dispose()
            return _empty_result()

        log.info(f"Using impact category: {target_impact.name}")

        # Get total impact for this category
        total_impact_value = result.get_total_impact_value_of(target_impact)
        total_impact = total_impact_value.amount if total_impact_value and total_impact_value.amount else 0.0
        log.info(f"Total impact: {total_impact}")

        # Get the impact category's reference unit
        ref_unit = _get_ref_unit(cl, target_impact)

        # ---- Native Sankey Graph API (openLCA >= 2.2) ----
        sankey_config = schema.SankeyRequest(
            impact_category=target_impact,
            max_nodes=max_nodes,
            min_share=min_share / 100.0,  # API expects fraction, UI sends percentage
        )

        sankey_graph = result.get_sankey_graph(sankey_config)
        result.dispose()

        if not sankey_graph or not sankey_graph.nodes:
            log.warning("Sankey graph is empty")
            return _empty_result()

        # Convert SankeyGraph to frontend format
        abs_total = abs(total_impact) if total_impact != 0 else 1.0

        nodes_data = []
        index_to_pos = {}  # map graph node index -> position in nodes_data list

        for i, node in enumerate(sankey_graph.nodes):
            index_to_pos[node.index] = i

            provider_name = "Unknown"
            flow_name = ""
            process_id = ""
            if node.tech_flow:
                if node.tech_flow.provider:
                    provider_name = node.tech_flow.provider.name or "Unknown"
                    process_id = node.tech_flow.provider.id or ""
                if node.tech_flow.flow:
                    flow_name = node.tech_flow.flow.name or ""

            direct = node.direct_result or 0.0
            upstream = node.total_result or 0.0

            nodes_data.append({
                "name": provider_name,
                "flowName": flow_name,
                "direct": direct,
                "upstream": upstream,
                "directPct": abs(direct / abs_total) * 100 if abs_total != 0 else 0,
                "upstreamPct": abs(upstream / abs_total) * 100 if abs_total != 0 else 0,
                "processId": process_id,
                "isRoot": node.index == sankey_graph.root_index,
            })

        # Build links from edges
        links_data = []
        if sankey_graph.edges:
            for edge in sankey_graph.edges:
                source_pos = index_to_pos.get(edge.provider_index)
                target_pos = index_to_pos.get(edge.node_index)

                if source_pos is not None and target_pos is not None and source_pos != target_pos:
                    share = edge.upstream_share or 0.0
                    value = abs(share * abs_total) if abs_total != 0 else 0.001

                    links_data.append({
                        "source": source_pos,
                        "target": target_pos,
                        "value": value,
                        "share": share,
                    })

        log.info(f"Sankey graph: {len(nodes_data)} nodes, {len(links_data)} edges")

        return {
            "nodes": nodes_data,
            "links": links_data,
            "totalImpact": total_impact,
            "impactUnit": ref_unit or target_impact.name or "impact",
            "impactCategory": target_impact.name,
            "rootIndex": index_to_pos.get(sankey_graph.root_index, 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        log.exception("Error computing Sankey")
        raise HTTPException(status_code=500, detail=str(e))


# Keep old endpoint for backward compatibility
@app.get("/api/graph/{system_id}")
def get_graph(system_id: str):
    return get_sankey(system_id)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
