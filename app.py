from flask import Flask, render_template, request

app = Flask(__name__)  # uses templates and static folders by default


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    checked_fields = {}
    if request.method == "POST":
        checked_fields = request.form.to_dict()
        reg_compliance = calculate_regulatory_readiness_score(checked_fields)
        return render_template(
            "tabs.html",
            active_tab="regulationscore",
            reg_compliance=reg_compliance,
            checked_fields=checked_fields,
        )

    reg_compliance = {
        "score": 0,
        "ets": 0,
        "csrd": 0,
        "eed": 0,
        "epa_ghg": 0,
        "data_quality": 0,
        "reporting_gaps": 0,
    }
    return render_template(
        "tabs.html", active_tab="nox", reg_compliance=reg_compliance, checked_fields=checked_fields
    )


def calculate_regulatory_readiness_score(form_data):
    """Calculate regulatory readiness score based on form data."""

    ets_items = ["ets_verified", "ets_allowances", "ets_monitoring"]
    csrd_items = ["csrd_esg", "csrd_materiality", "csrd_taxonomy"]
    eed_items = ["eed_audit", "eed_plan"]
    epa_items = ["epa_reporting", "epa_submitted"]
    data_items = ["data_calibration", "data_audit", "data_gdpr"]
    deadline_items = ["deadlines_gap"]

    def score_for(items):
        if not items:
            return 0.0
        completed = sum(1 for item in items if form_data.get(item) == "on")
        return (completed / len(items)) * 100

    ets_score = score_for(ets_items)
    csrd_score = score_for(csrd_items)
    eed_score = score_for(eed_items)
    epa_score = score_for(epa_items)
    data_score = score_for(data_items)
    deadline_score = score_for(deadline_items)

    overall_score = round(
        (ets_score + csrd_score + eed_score + epa_score + data_score + deadline_score) / 6
    )

    return {
        "score": overall_score,
        "ets": round(ets_score),
        "csrd": round(csrd_score),
        "eed": round(eed_score),
        "epa_ghg": round(epa_score),
        "data_quality": round(data_score),
        "reporting_gaps": round(deadline_score),
    }


if __name__ == "__main__":
    app.run(debug=True)
