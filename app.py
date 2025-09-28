from flask import Flask, render_template, request

app = Flask(__name__)  # uses templates and static folders by default

@app.route("/")
def home():
    return render_template("index.html")
@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    if request.method == 'POST':
        # load form info
        data = request.form.to_dict()  
        print("Form data received:", data)

        # calculate score
        reg_compliance = calculate_regulatory_readiness_score(data)
        print("Calculated compliance:", reg_compliance)
        return render_template("tabs.html", active_tab="regulationscore", reg_compliance=reg_compliance)

    # Default empty compliance data for GET requests
    reg_compliance = {
        'score': 0,
        'ets': 0,
        'csrd': 0,
        'eed': 0,
        'epa_ghg': 0,
        'data_quality': 0,
        'reporting_gaps': 0
    }
    return render_template("tabs.html", active_tab="nox", reg_compliance=reg_compliance)

def calculate_regulatory_readiness_score(form_data):
    """Calculate regulatory readiness score based on form data.
    
    Args:
        form_data: Dictionary containing form checkbox values
        
    Returns:
        Dictionary with score and breakdown by category
    """
    # Count checked items in each category
    ets_items = ['ets_verified', 'ets_allowances', 'ets_monitoring']
    csrd_items = ['csrd_esg', 'csrd_materiality', 'csrd_taxonomy']
    eed_items = ['eed_audit', 'eed_plan']
    epa_items = ['epa_reporting', 'epa_submitted']
    data_items = ['data_calibration', 'data_audit', 'data_gdpr']
    deadline_items = ['deadlines_gap']
    
    # Calculate scores for each category
    ets_score = sum(1 for item in ets_items if form_data.get(item) == 'on') / len(ets_items) * 100
    csrd_score = sum(1 for item in csrd_items if form_data.get(item) == 'on') / len(csrd_items) * 100
    eed_score = sum(1 for item in eed_items if form_data.get(item) == 'on') / len(eed_items) * 100
    epa_score = sum(1 for item in epa_items if form_data.get(item) == 'on') / len(epa_items) * 100
    data_score = sum(1 for item in data_items if form_data.get(item) == 'on') / len(data_items) * 100
    deadline_score = sum(1 for item in deadline_items if form_data.get(item) == 'on') / len(deadline_items) * 100
    
    # Calculate overall score (weighted average)
    overall_score = round((ets_score + csrd_score + eed_score + epa_score + data_score + deadline_score) / 6)
    
    return {
        'score': overall_score,
        'ets': round(ets_score),
        'csrd': round(csrd_score),
        'eed': round(eed_score),
        'epa_ghg': round(epa_score),
        'data_quality': round(data_score),
        'reporting_gaps': round(deadline_score)
    }

if __name__ == "__main__":
    app.run(debug=True)
