import json
import subprocess
import sys

TEMPLATES = {
    "Plant": [
        ("CIV-01", "L3", "Civil Works & Foundations", "Civil", None),
        ("CIV-FND-01", "L5", "Equipment Foundation Excavation & Reinforcement", "Civil", "CIV-01"),
        ("CIV-CON-02", "L5", "Foundation Concrete Pouring & Curing", "Civil", "CIV-01"),
        ("CIV-STR-03", "L6", "Superstructure Grouting & Load Testing", "Civil", "CIV-01"),
        ("PIP-01", "L3", "Process & Utility Piping", "Piping", None),
        ("PIP-FAB-01", "L5", "Spool Pre-fabrication & Fit-up", "Piping", "PIP-01"),
        ("PIP-WLD-02", "L5", "Header Tie-in Welding & NDT Radiography", "Piping", "PIP-01"),
        ("PIP-HYD-03", "L6", "Hydrostatic Pressure Testing & De-watering", "Piping", "PIP-01"),
        ("ELE-01", "L3", "Electrical Substation & Power", "Electrical", None),
        ("ELE-TR-01", "L5", "Transformer Placement & Busbar Installation", "Electrical", "ELE-01"),
        ("ELE-SWG-02", "L5", "HT Switchgear Panel Termination & Testing", "Electrical", "ELE-01"),
        ("ELE-CBL-03", "L6", "Armored Power Cable Trenching & Glanding", "Electrical", "ELE-01"),
        ("INS-01", "L3", "Instrumentation & Telemetry", "Instrumentation", None),
        ("INS-JB-01", "L5", "Marshalling Junction Box Termination", "Instrumentation", "INS-01"),
        ("INS-DCS-02", "L5", "SCADA DCS Loop Checking & Telemetry Integration", "Instrumentation", "INS-01"),
        ("INS-CAL-03", "L6", "Pressure Transmitter Field Calibration", "Instrumentation", "INS-01"),
        ("HSE-01", "L3", "Safety & Statutory Compliance", "HSE", None),
        ("HSE-AUD-01", "L5", "Pre-commissioning Safety & Fire Deluge Audit", "HSE", "HSE-01")
    ],
    "Pipeline": [
        ("ROW-01", "L3", "Right of Way Clearing & Grading", "Pipeline", None),
        ("ROW-CLR-01", "L5", "Route Clearing & Topsoil Stripping", "Pipeline", "ROW-01"),
        ("ROW-GRD-02", "L5", "Bench Grading & Leveling", "Pipeline", "ROW-01"),
        ("PIP-TR-01", "L3", "Mainline Trenching & Stringing", "Pipeline", None),
        ("PIP-STR-01", "L5", "Line Pipe Hauling & Stringing", "Pipeline", "PIP-TR-01"),
        ("PIP-TRN-02", "L5", "Trench Excavation & Padding", "Pipeline", "PIP-TR-01"),
        ("PIP-WLD-03", "L6", "Automatic / Manual Line-up & Mainline Welding", "Pipeline", "PIP-TR-01"),
        ("PIP-NDT-04", "L6", "Ultrasonic & Radiographic Weld Inspection", "Pipeline", "PIP-TR-01"),
        ("PIP-LWR-05", "L5", "Pipe Lowering & Tie-in Joint Wrapping", "Pipeline", "PIP-TR-01"),
        ("PIP-CRS-01", "L3", "River & Highway Crossings (HDD)", "Pipeline", None),
        ("PL-HDD-01", "L5", "Horizontal Directional Drilling Pilot Bore", "Pipeline", "PIP-CRS-01"),
        ("PL-HDD-02", "L6", "Reaming & Pipeline Pullback", "Pipeline", "PIP-CRS-01"),
        ("CP-01", "L3", "Cathodic Protection & Monitoring", "Pipeline", None),
        ("PL-CP-01", "L5", "Deep Well Anode Groundbed Installation", "Pipeline", "CP-01"),
        ("PL-CP-02", "L6", "Test Lead Station Wiring & Potential Survey", "Pipeline", "CP-01"),
        ("PIP-TST-01", "L3", "Hydrotesting & Pre-commissioning", "Pipeline", None),
        ("PIP-HYD-01", "L5", "Sectional Hydrostatic Pressure Test", "Pipeline", "PIP-TST-01"),
        ("PIP-DRY-02", "L6", "Air Drying & Nitrogen Blanketing", "Pipeline", "PIP-TST-01")
    ],
    "Roads": [
        ("EAR-01", "L3", "Earthwork & Subgrade Preparation", "Civil", None),
        ("EAR-SUB-01", "L5", "Clearing, Grubbing & Topsoil Stripping", "Civil", "EAR-01"),
        ("EAR-EMB-02", "L5", "Embankment Fill & Subgrade Compaction", "Civil", "EAR-01"),
        ("PAV-01", "L3", "Granular Sub-base & Paving", "Civil", None),
        ("PAV-GSB-01", "L5", "Granular Sub-Base (GSB) Layer Laying", "Civil", "PAV-01"),
        ("PAV-WMM-02", "L5", "Wet Mix Macadam (WMM) Base Construction", "Civil", "PAV-01"),
        ("PAV-DBM-03", "L6", "Dense Bituminous Macadam (DBM) Surfacing", "Civil", "PAV-01"),
        ("PAV-BC-04", "L6", "Bituminous Concrete (BC) Final Wearing Course", "Civil", "PAV-01"),
        ("STR-01", "L3", "Culverts, Bridges & Retaining Walls", "Civil", None),
        ("STR-BOX-01", "L5", "RCC Box Culvert Foundation & Raft", "Civil", "STR-01"),
        ("STR-PIER-02", "L5", "Flyover Pier & Pier Cap Reinforcement", "Civil", "STR-01"),
        ("STR-GIRD-03", "L6", "Precast PSC Girder Launching & Deck Slab Pouring", "Civil", "STR-01"),
        ("DRN-01", "L3", "Drainage & Roadway Safety Furniture", "Civil", None),
        ("DRN-MED-01", "L5", "RCC Median Drain & Side Drain Construction", "Civil", "DRN-01"),
        ("DRN-SGN-02", "L6", "Crash Barrier Installation & Road Signage", "Civil", "DRN-01")
    ]
}

TEMPLATES["Wellhead"] = TEMPLATES["Plant"]
TEMPLATES["Other"] = TEMPLATES["Plant"]

def get_projects_with_zero_activities():
    cmd = "npx wrangler d1 execute oil-field-db --command \"SELECT p.id, p.code, p.name, p.project_type, count(a.id) as act_count FROM projects p LEFT JOIN activities a ON p.id = a.project_id GROUP BY p.id HAVING act_count = 0\" --remote"
    res = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding='utf-8', errors='replace')
    out = res.stdout
    start = out.find("[")
    end = out.rfind("]")
    if start == -1 or end == -1:
        print("Could not find json in output:", out)
        return []
    data = json.loads(out[start:end+1])
    return data[0]["results"]

def generate_sql(projects):
    statements = []
    for p in projects:
        p_id = p["id"]
        p_type = p.get("project_type") or "Plant"
        tpl = TEMPLATES.get(p_type, TEMPLATES["Plant"])
        
        code_to_id = {}
        for code, level, name, disc, parent_code in tpl:
            act_id = f"ACT-{p_id}-{code}".replace(" ", "-").replace("\t", "")
            code_to_id[code] = act_id
        
        for code, level, name, disc, parent_code in tpl:
            act_id = code_to_id[code]
            parent_id = f"'{code_to_id[parent_code]}'" if parent_code else "NULL"
            prog = 20 if level in ("L5", "L6") else 35
            stat = "in-progress"
            escaped_name = name.replace("'", "''")
            
            stmt = f"INSERT OR REPLACE INTO activities (id, project_id, parent_id, level, code, name, discipline, planned_start, planned_finish, progress, status, variance) VALUES ('{act_id}', '{p_id}', {parent_id}, '{level}', '{code}', '{escaped_name}', '{disc}', '2026-08-01', '2026-11-30', {prog}, '{stat}', 0);"
            statements.append(stmt)
            
    return statements

if __name__ == "__main__":
    projects = get_projects_with_zero_activities()
    print(f"Found {len(projects)} projects without activities.")
    statements = generate_sql(projects)
    print(f"Generated {len(statements)} activity INSERT statements.")
    
    with open("worker/seed_all_projects.sql", "w", encoding="utf-8") as f:
        f.write("\n".join(statements))
    print("Wrote worker/seed_all_projects.sql")
