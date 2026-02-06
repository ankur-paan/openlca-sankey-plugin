"""Debug script: inspect openLCA IPC connection and data structures (2.6.0)."""

import olca_ipc as olca
import olca_schema as schema

client = olca.Client(8080)

print("Connecting to openLCA IPC...")
try:
    print("Fetching Product Systems...")
    systems = client.get_descriptors(schema.ProductSystem)
    print(f"Found {len(systems)} systems.")

    if systems:
        first_system = systems[0]
        print(f"Inspecting first system: {first_system.name} (ID: {first_system.id})")

        system = client.get(schema.ProductSystem, first_system.id)
        if system:
            print(f"System loaded: {system.name}")
            if system.process_links:
                print(f"Process Links found: {len(system.process_links)}")
                for i, link in enumerate(system.process_links[:5]):
                    recipient_name = link.process.name if link.process else "Unknown"
                    provider_name = link.provider.name if link.provider else "Unknown"
                    flow_name = link.flow.name if link.flow else "Unknown"
                    print(f"  Link {i}: {provider_name} -> {flow_name} -> {recipient_name}")
            else:
                print("No process links found directly in system.")

            if system.ref_process:
                print(f"Reference Process: {system.ref_process.name}")
                ref_proc = client.get(schema.Process, system.ref_process.id)
                if ref_proc:
                    print(f"Reference Process Object Loaded: {ref_proc.name}")
                    if ref_proc.exchanges:
                        print(f"Exchanges found: {len(ref_proc.exchanges)}")
                        for exc in ref_proc.exchanges:
                            flow_name = exc.flow.name if exc.flow else "?"
                            provider = exc.default_provider.name if exc.default_provider else "None"
                            print(f"  Exchange: Flow={flow_name}, Input={exc.is_input}, Provider={provider}")
                    else:
                        print("No exchanges in reference process.")
        else:
            print("Failed to load details for the system.")

        # Check impact methods
        print("\n--- Impact Methods ---")
        methods = client.get_descriptors(schema.ImpactMethod)
        print(f"Found {len(methods)} impact methods")
        for m in methods[:3]:
            full_method = client.get(schema.ImpactMethod, m.id)
            if full_method and full_method.impact_categories:
                print(f"  {m.name}: {len(full_method.impact_categories)} categories")
                for cat_ref in full_method.impact_categories[:3]:
                    full_cat = client.get(schema.ImpactCategory, cat_ref.id)
                    unit = full_cat.ref_unit if full_cat else "?"
                    print(f"    - {cat_ref.name} [{unit}]")

    else:
        print("No product systems found in the database.")

except Exception as e:
    import traceback
    traceback.print_exc()
