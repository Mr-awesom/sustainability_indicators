from flask import Flask, render_template

app = Flask(__name__)  # uses templates and static folders by default

@app.route("/")
def home():
    return render_template("index.html")
@app.route('/dashboard')
def dashboard():
    return render_template("tabs.html", active_tab="dashboard")

if __name__ == "__main__":
    app.run(debug=True)
