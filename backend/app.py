from flask import Flask, send_from_directory
from flask_cors import CORS

from api.trips import trips_bp
from api.stats import stats_bp
from api.zones import zones_bp
from api.insights import insights_bp

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

app.register_blueprint(trips_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(zones_bp)
app.register_blueprint(insights_bp)


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)
