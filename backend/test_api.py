"""
Test script to verify openLCA 2.6.0 IPC API responses,
including the native get_sankey_graph() API.
"""
import time
import olca_ipc as olca
import olca_schema as schema

# Connect to openLCA
client = olca.Client(8080)
print("Connected to openLCA")

# Get product systems
systems = client.get_descriptors(schema.ProductSystem)
print(f"\nFound {len(systems)} product systems:")
for i, s in enumerate(systems[:5]):
    print(f"  {i+1}. {s.name} (ID: {s.id})")

if not systems:
    print("No product systems found!")
    exit(1)

# Use first system
system_ref = systems[0]
system = client.get(schema.ProductSystem, system_ref.id)
print(f"\nUsing system: {system.name}")

# Get impact methods
methods = client.get_descriptors(schema.ImpactMethod)
print(f"\nFound {len(methods)} impact methods:")
for i, m in enumerate(methods[:5]):
    print(f"  {i+1}. {m.name}")

if not methods:
    print("No impact methods found!")
    exit(1)

method_ref = schema.Ref(id=methods[0].id, name=methods[0].name)
print(f"\nUsing method: {method_ref.name}")

# Setup and run calculation
setup = schema.CalculationSetup(
    target=system.to_ref(),
    impact_method=method_ref,
    amount=system.target_amount or 1.0,
)

print("\nRunning calculation...")
result = client.calculate(setup)

if result.error:
    print(f"Calculation error: {result.error}")
    exit(1)

# Wait for result
max_wait = 60
waited = 0
while waited < max_wait:
    state = result.get_state()
    if state.is_ready:
        print(f"Calculation ready after {waited}s")
        break
    if state.error:
        print(f"Error: {state.error}")
        exit(1)
    time.sleep(0.5)
    waited += 0.5

# Get impact categories
impact_cats = result.get_impact_categories()
print(f"\nImpact categories in result: {len(impact_cats)}")
for i, cat in enumerate(impact_cats[:10]):
    print(f"  {i+1}. {cat.name} (ID: {cat.id})")

if not impact_cats:
    print("No impact categories!")
    result.dispose()
    exit(1)

# Check total impacts
print("\n--- Total Impacts ---")
total_impacts = result.get_total_impacts()
for ti in total_impacts[:10]:
    print(f"  {ti.impact_category.name}: {ti.amount}")

# Pick a category with non-zero impact
target_cat = None
for ti in total_impacts:
    if ti.amount and abs(ti.amount) > 0:
        target_cat = ti.impact_category
        print(f"\nUsing category with impact: {target_cat.name} = {ti.amount}")
        break

if not target_cat:
    print("\nALL CATEGORIES HAVE ZERO IMPACT!")
    result.dispose()
    exit(1)

# Get ref_unit for the impact category
full_cat = client.get(schema.ImpactCategory, target_cat.id)
ref_unit = full_cat.ref_unit if full_cat and full_cat.ref_unit else "?"
print(f"Reference unit: {ref_unit}")

# ---- Test native Sankey Graph API (openLCA >= 2.2) ----
print(f"\n--- Native Sankey Graph API ---")
sankey_config = schema.SankeyRequest(
    impact_category=target_cat,
    max_nodes=15,
    min_share=0.01,
)

sankey_graph = result.get_sankey_graph(sankey_config)
if sankey_graph:
    print(f"Root index: {sankey_graph.root_index}")
    print(f"Nodes: {len(sankey_graph.nodes)}")
    print(f"Edges: {len(sankey_graph.edges)}")

    total_val = result.get_total_impact_value_of(target_cat)
    abs_total = abs(total_val.amount) if total_val and total_val.amount else 1.0

    for node in sankey_graph.nodes[:10]:
        name = node.tech_flow.provider.name if node.tech_flow and node.tech_flow.provider else "?"
        flow = node.tech_flow.flow.name if node.tech_flow and node.tech_flow.flow else "?"
        direct_pct = abs(node.direct_result / abs_total) * 100 if abs_total else 0
        total_pct = abs(node.total_result / abs_total) * 100 if abs_total else 0
        is_root = " [ROOT]" if node.index == sankey_graph.root_index else ""
        print(f"  Node {node.index}: {name} ({flow})")
        print(f"    direct={node.direct_result:.6f} ({direct_pct:.2f}%),  total={node.total_result:.6f} ({total_pct:.2f}%){is_root}")

    for edge in sankey_graph.edges[:10]:
        print(f"  Edge: provider={edge.provider_index} -> node={edge.node_index}, share={edge.upstream_share:.4f}")
else:
    print("  get_sankey_graph returned None - this API may not be supported in your openLCA version")

result.dispose()
print("\nDone!")
