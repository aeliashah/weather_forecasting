 Overview

This project builds a complete weather forecasting pipeline on the Historical Hourly Weather Data 2012–2017 dataset (Denver), covering data ingestion, feature engineering, model training, evaluation, and deployment.

Seven models are trained and compared head-to-head — three classical ML models and four deep learning architectures — to explore how model complexity trades off against forecasting accuracy on time-series weather data.

 Features


7 trained models: Linear Regression, Random Forest, XGBoost, ANN, RNN, LSTM, GRU
Interactive dashboard with 6 views: Overview, EDA, Model Results, Live Prediction, Residual Analysis, and Model Comparison
Live prediction tool — enter weather parameters and get an instant temperature forecast
Full evaluation suite — MAE, RMSE, R², and MAPE for every model
Residual analysis — error distribution and time-series error plots per model
Feature engineering — cyclical time encodings, lag features, and rolling statistics


 Tech Stack

CategoryToolsData & MLpandas, NumPy, scikit-learn, XGBoostDeep LearningKeras 3VisualizationMatplotlib, SeabornDashboardStreamlitDeploymentStreamlit Community Cloud

 Pipeline

PhaseStep1Load & merge 5 raw CSV files (temperature, humidity, pressure, wind speed, wind direction)2Exploratory data analysis — distributions, correlations3Missing value imputation (forward/backward fill)4Feature engineering — lag features, cyclical (sin/cos) time encodings, rolling statistics580/20 chronological train-test split6MinMax scaling7Train 7 models (LR, RF, XGBoost, ANN, RNN, LSTM, GRU)8Evaluate with MAE, RMSE, R², MAPE9Visualize predictions and residuals10Deploy via Streamlit

 Best model by R²: Random Forest (R² = 0.9873)

📁 Project Structure

weather_forecasting/
├── data/                   # Raw CSVs (not tracked — see Setup)
├── artefacts/               # Trained models, scalers, predictions
├── plots/                   # Generated EDA & evaluation plots
├── main.py                  # Full training pipeline
├── app.py                   # Streamlit dashboard
├── requirements.txt
└── README.md

🚀 Setup & Installation


Clone the repo


bash   git clone https://github.com/aeliashah/weather_forecasting.git
   cd weather_forecasting


Install dependencies


bash   pip install -r requirements.txt


Add the dataset
Download the Historical Hourly Weather Data from Kaggle and place temperature.csv, humidity.csv, pressure.csv, wind_speed.csv, and wind_direction.csv into a data/ folder.
Train all 7 models


bash   python main.py


Launch the dashboard


bash   streamlit run app.py
