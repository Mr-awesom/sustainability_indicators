from flask import Flask, render_template, request

app = Flask(__name__)  # uses templates and static folders by default


CHECKBOX_FIELDS = [
    "ets_verified",
    "ets_allowances",
    "ets_monitoring",
    "csrd_esg",
    "csrd_materiality",
    "csrd_taxonomy",
    "eed_audit",
    "eed_plan",
    "epa_reporting",
    "epa_submitted",
    "data_calibration",
    "data_audit",
    "data_gdpr",
    "deadlines_gap",
]

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    form_state = {field: False for field in CHECKBOX_FIELDS}
    reg_compliance = _empty_compliance_snapshot()
    active_tab = "nox"

    if request.method == "POST":
        for field in CHECKBOX_FIELDS:
            form_state[field] = request.form.get(field) == "on"
        reg_compliance = calculate_regulatory_readiness_score(form_state)
        active_tab = "regulationscore"

    return render_template(
        "tabs.html",
        active_tab=active_tab,
        reg_compliance=reg_compliance,
        form_state=form_state,
    )

if __name__ == "__main__":
    app.run(debug=True)


def calculate_regulatory_readiness_score(form_state):
    """Calculate regulatory readiness score from submitted checkbox state."""

    categories = {
        "ets": ["ets_verified", "ets_allowances", "ets_monitoring"],
        "csrd": ["csrd_esg", "csrd_materiality", "csrd_taxonomy"],
        "eed": ["eed_audit", "eed_plan"],
        "epa_ghg": ["epa_reporting", "epa_submitted"],
        "data_quality": ["data_calibration", "data_audit", "data_gdpr"],
        "reporting_gaps": ["deadlines_gap"],
    }

    breakdown = {}
    total = 0
    for key, items in categories.items():
        completed = sum(1 for item in items if form_state.get(item))
        raw_score = round((completed / len(items)) * 100) if items else 0
        score = max(0, min(100, raw_score))
        breakdown[key] = score
        total += score

    overall = round(total / len(categories)) if categories else 0
    overall = max(0, min(100, overall))
    breakdown["score"] = overall
    return breakdown


def _empty_compliance_snapshot():
    return {
        "score": 0,
        "ets": 0,
        "csrd": 0,
        "eed": 0,
        "epa_ghg": 0,
        "data_quality": 0,
        "reporting_gaps": 0,
    }
