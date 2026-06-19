"""
Streamlit Weather Forecasting Dashboard - All 7 Models
Run: py -m streamlit run app.py
"""

import os, pickle, math, warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

os.environ["KERAS_BACKEND"] = "numpy"

st.set_page_config(
    page_title="Weather Forecasting AI",
    page_icon="🌤️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .metric-card {
        background: linear-gradient(135deg, #1e3a5f, #2d6a9f);
        padding: 1rem 1.5rem;
        border-radius: 12px;
        color: white;
        text-align: center;
        margin: 0.3rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .metric-card h2 { margin: 0; font-size: 2rem; }
    .metric-card p  { margin: 0; opacity: 0.8; font-size: 0.85rem; }
    .section-header {
        font-size: 1.4rem;
        font-weight: 700;
        padding: 0.4rem 0;
        border-bottom: 3px solid #2d6a9f;
        margin-bottom: 1rem;
        color: #1e3a5f;
    }
    div[data-testid="stSidebar"] { background: #0d1b2a; }
    div[data-testid="stSidebar"] * { color: #e0e0e0 !important; }
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────
# LOAD ARTEFACTS
# ─────────────────────────────────────────────────────────────
@st.cache_resource
def load_artefacts():
    arts = {}
    try:
        arts["feat_scaler"]   = pickle.load(open("artefacts/feat_scaler.pkl",       "rb"))
        arts["target_scaler"] = pickle.load(open("artefacts/target_scaler.pkl",     "rb"))
        arts["feature_names"] = pickle.load(open("artefacts/feature_names.pkl",     "rb"))
        arts["lr"]            = pickle.load(open("artefacts/linear_regression.pkl", "rb"))
        arts["rf"]            = pickle.load(open("artefacts/random_forest.pkl",     "rb"))
        arts["xgb"]           = pickle.load(open("artefacts/xgboost.pkl",           "rb"))

        try:
            import keras
            arts["ann"]  = keras.models.load_model("artefacts/ann.keras")
            arts["rnn"]  = keras.models.load_model("artefacts/rnn.keras")
            arts["lstm"] = keras.models.load_model("artefacts/lstm.keras")
            arts["gru"]  = keras.models.load_model("artefacts/gru.keras")
            arts["dl_available"] = True
        except Exception:
            arts["dl_available"] = False

        arts["y_test"]     = np.load("artefacts/y_test.npy")
        arts["y_test_seq"] = np.load("artefacts/y_test_seq.npy")
        arts["pred_lr"]    = np.load("artefacts/pred_lr.npy")
        arts["pred_rf"]    = np.load("artefacts/pred_rf.npy")
        arts["pred_xgb"]   = np.load("artefacts/pred_xgb.npy")
        arts["pred_ann"]   = np.load("artefacts/pred_ann.npy")
        arts["pred_rnn"]   = np.load("artefacts/pred_rnn.npy")
        arts["pred_lstm"]  = np.load("artefacts/pred_lstm.npy")
        arts["pred_gru"]   = np.load("artefacts/pred_gru.npy")
        arts["comp"]       = pd.read_csv("artefacts/model_comparison.csv", index_col=0)
        arts["loaded"] = True
    except FileNotFoundError:
        arts["loaded"] = False
    return arts

arts = load_artefacts()

# ─────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("🌤️ Weather AI")
    st.markdown("---")
    page = st.radio("Navigate", [
        "🏠 Overview",
        "📊 EDA & Data",
        "📈 Model Results",
        "🔮 Live Prediction",
        "📉 Residual Analysis",
        "🏆 Model Comparison"
    ])
    st.markdown("---")
    st.caption("Dataset: Historical Hourly Weather 2012-2017")
    st.caption("City: Denver")
    st.caption("Models: LR | RF | XGB | ANN | RNN | LSTM | GRU")

# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def k_to_c(k): return k - 273.15

ML_MODELS  = {"Linear Regression": "pred_lr", "Random Forest": "pred_rf", "XGBoost": "pred_xgb", "ANN": "pred_ann"}
SEQ_MODELS = {"RNN": "pred_rnn", "LSTM": "pred_lstm", "GRU": "pred_gru"}
ALL_MODELS = list(ML_MODELS.keys()) + list(SEQ_MODELS.keys())

def metrics_row(y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = math.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100
    cols = st.columns(4)
    for col, lbl, val in zip(cols, ["MAE (K)", "RMSE (K)", "R² Score", "MAPE (%)"], [mae, rmse, r2, mape]):
        col.markdown(f"""<div class="metric-card"><h2>{val:.4f}</h2><p>{lbl}</p></div>""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────
# PAGE: OVERVIEW
# ─────────────────────────────────────────────────────────────
if page == "🏠 Overview":
    st.title("🌤️ AI Weather Forecasting Dashboard")
    st.markdown("**Dataset:** Historical Hourly Weather 2012-2017 | **City:** Denver | **Target:** Temperature")
    st.markdown("---")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("📅 Data Range", "2012 - 2017")
    c2.metric("⏱️ Frequency",  "Hourly")
    c3.metric("📊 Features",   "17 engineered")
    c4.metric("🤖 Models",     "7 trained")

    st.markdown("---")
    st.markdown("""
    ### Project Pipeline
    | Phase | Step |
    |---|---|
    | 1 | Load & merge 5 CSV files |
    | 2 | EDA - distributions, correlations |
    | 3 | Missing value imputation (forward-fill) |
    | 4 | Feature engineering - lags, cyclical encodings, rolling stats |
    | 5 | 80/20 chronological train-test split |
    | 6 | MinMaxScaler normalisation |
    | 7 | Train: Linear Regression, Random Forest, XGBoost, ANN, RNN, LSTM, GRU |
    | 8 | Evaluate: MAE, RMSE, R², MAPE |
    | 9 | Visualise predictions and residuals |
    | 10 | Streamlit deployment |
    """)

    st.markdown("### Models Used")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("""
        **Classical ML**
        - 📈 Linear Regression (Baseline)
        - 🌲 Random Forest (200 trees)
        - 🚀 XGBoost (500 estimators)
        """)
    with col2:
        st.markdown("""
        **Deep Learning**
        - 🧠 ANN (256→128→64→1)
        - 🔃 Simple RNN (128→64)
        - 🔁 LSTM (128→64)
        - 🔄 GRU (128→64)
        """)

    if arts["loaded"]:
        st.success("✅ All 7 models loaded successfully!")
    else:
        st.warning("⚠️ Run `py main.py` first to train models.")

# ─────────────────────────────────────────────────────────────
# PAGE: EDA
# ─────────────────────────────────────────────────────────────
elif page == "📊 EDA & Data":
    st.markdown('<p class="section-header">📊 Exploratory Data Analysis</p>', unsafe_allow_html=True)
    for img, cap in [
        ("plots/01_eda_timeseries.png",    "Time-series of all features (2012-2017)"),
        ("plots/02_correlation.png",       "Feature correlation heatmap"),
        ("plots/03_feature_importance.png","Top-15 Feature Importances - Random Forest"),
    ]:
        if os.path.exists(img):
            st.image(img, caption=cap, use_container_width=True)
        else:
            st.info(f"Run main.py to generate: {img}")

# ─────────────────────────────────────────────────────────────
# PAGE: MODEL RESULTS
# ─────────────────────────────────────────────────────────────
elif page == "📈 Model Results":
    st.markdown('<p class="section-header">📈 Actual vs Predicted</p>', unsafe_allow_html=True)
    if not arts["loaded"]:
        st.warning("Run py main.py first."); st.stop()

    model_choice = st.selectbox("Select Model", ALL_MODELS)

    if model_choice in ML_MODELS:
        y_true = arts["y_test"]
        y_pred = arts[ML_MODELS[model_choice]]
    else:
        y_true = arts["y_test_seq"]
        y_pred = arts[SEQ_MODELS[model_choice]]

    metrics_row(y_true, y_pred)
    st.markdown("")

    n = st.slider("Hours to display", 100, min(2000, len(y_true)), 500, 50)
    fig, ax = plt.subplots(figsize=(14, 4))
    ax.plot(k_to_c(y_true[:n]), label="Actual",    linewidth=1.2)
    ax.plot(k_to_c(y_pred[:n]), label="Predicted", linewidth=1.0, alpha=0.85)
    ax.set_title(f"{model_choice} - Actual vs Predicted (°C)")
    ax.set_ylabel("Temperature (°C)"); ax.legend(); ax.grid(True, alpha=0.3)
    st.pyplot(fig)

    img_map = {
        "Linear Regression": "plots/04_lr_pred.png",
        "Random Forest":     "plots/06_rf_pred.png",
        "XGBoost":           "plots/08_xgb_pred.png",
        "ANN":               "plots/10_ann_pred.png",
        "RNN":               "plots/12_rnn_pred.png",
        "LSTM":              "plots/14_lstm_pred.png",
        "GRU":               "plots/16_gru_pred.png",
    }
    if os.path.exists(img_map.get(model_choice, "")):
        st.image(img_map[model_choice], use_container_width=True)

# ─────────────────────────────────────────────────────────────
# PAGE: LIVE PREDICTION
# ─────────────────────────────────────────────────────────────
elif page == "🔮 Live Prediction":
    st.markdown('<p class="section-header">🔮 Live Temperature Prediction</p>', unsafe_allow_html=True)
    if not arts["loaded"]:
        st.warning("Run py main.py first."); st.stop()

    st.markdown("Enter current weather parameters:")
    c1, c2 = st.columns(2)
    with c1:
        humidity       = st.number_input("Humidity (%)",       0.0, 100.0, 55.0)
        pressure       = st.number_input("Pressure (hPa)",     900.0, 1100.0, 1013.0)
        wind_speed     = st.number_input("Wind Speed (m/s)",   0.0, 50.0, 5.0)
        wind_direction = st.number_input("Wind Direction (°)", 0.0, 360.0, 180.0)
    with c2:
        hour        = st.slider("Hour of Day",         0, 23,  12)
        month       = st.slider("Month",                1, 12,   6)
        day_of_week = st.slider("Day of Week (0=Mon)", 0,  6,   2)
        day_of_year = st.slider("Day of Year",         1, 365, 150)

    model_choice = st.selectbox("Model", ["Linear Regression", "Random Forest", "XGBoost"])

    feat_names = arts["feature_names"]
    row = {f: 0.0 for f in feat_names}
    row.update({
        "humidity": humidity, "pressure": pressure,
        "wind_speed": wind_speed, "wind_direction": wind_direction,
        "hour": hour, "day_of_week": day_of_week,
        "month": month, "day_of_year": day_of_year,
        "hour_sin":  np.sin(2 * np.pi * hour        / 24),
        "hour_cos":  np.cos(2 * np.pi * hour        / 24),
        "month_sin": np.sin(2 * np.pi * month       / 12),
        "month_cos": np.cos(2 * np.pi * month       / 12),
        "dow_sin":   np.sin(2 * np.pi * day_of_week / 7),
        "dow_cos":   np.cos(2 * np.pi * day_of_week / 7),
    })

    X_input  = np.array([[row[f] for f in feat_names]])
    X_scaled = arts["feat_scaler"].transform(X_input)

    if st.button("🔮 Predict Temperature", type="primary"):
        model_obj = {"Linear Regression": arts["lr"],
                     "Random Forest": arts["rf"],
                     "XGBoost": arts["xgb"]}[model_choice]
        pred_k = model_obj.predict(X_scaled)[0]
        pred_c = k_to_c(pred_k)
        pred_f = pred_c * 9/5 + 32

        st.markdown("---")
        r1, r2, r3 = st.columns(3)
        r1.metric("🌡️ Kelvin",     f"{pred_k:.2f} K")
        r2.metric("🌡️ Celsius",    f"{pred_c:.2f} °C")
        r3.metric("🌡️ Fahrenheit", f"{pred_f:.2f} °F")

        fig, ax = plt.subplots(figsize=(6, 2))
        norm_val = max(0, min(1, (pred_c + 30) / 80))
        ax.barh(0, norm_val,               color=plt.cm.RdYlBu_r(norm_val), height=0.5)
        ax.barh(0, 1-norm_val, left=norm_val, color="#e0e0e0",              height=0.5)
        ax.set_xlim(0, 1); ax.axis("off")
        ax.set_title(f"Predicted: {pred_c:.1f} °C", fontsize=13, fontweight="bold")
        st.pyplot(fig)

# ─────────────────────────────────────────────────────────────
# PAGE: RESIDUAL ANALYSIS
# ─────────────────────────────────────────────────────────────
elif page == "📉 Residual Analysis":
    st.markdown('<p class="section-header">📉 Residual Analysis</p>', unsafe_allow_html=True)
    if not arts["loaded"]:
        st.warning("Run py main.py first."); st.stop()

    model_choice = st.selectbox("Select Model", ALL_MODELS)
    if model_choice in ML_MODELS:
        y_true = arts["y_test"]
        y_pred = arts[ML_MODELS[model_choice]]
    else:
        y_true = arts["y_test_seq"]
        y_pred = arts[SEQ_MODELS[model_choice]]

    resid = y_true - y_pred
    c1, c2 = st.columns(2)
    with c1:
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(resid[:500], color="tomato", linewidth=0.8)
        ax.axhline(0, color="k", linewidth=0.8, linestyle="--")
        ax.set_title("Residuals over time"); ax.set_ylabel("Error (K)")
        ax.grid(True, alpha=0.3); st.pyplot(fig)
    with c2:
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.hist(resid, bins=60, color="steelblue", edgecolor="white")
        ax.set_title("Residual Distribution"); ax.set_xlabel("Error (K)")
        ax.grid(True, alpha=0.3); st.pyplot(fig)

    st.markdown(f"""
    **Residual Stats:**
    - Mean error : `{resid.mean():.4f} K`
    - Std dev    : `{resid.std():.4f} K`
    - Max error  : `{resid.max():.4f} K`
    - Min error  : `{resid.min():.4f} K`
    """)

# ─────────────────────────────────────────────────────────────
# PAGE: MODEL COMPARISON
# ─────────────────────────────────────────────────────────────
elif page == "🏆 Model Comparison":
    st.markdown('<p class="section-header">🏆 Model Comparison</p>', unsafe_allow_html=True)
    if not arts["loaded"]:
        st.warning("Run py main.py first."); st.stop()

    comp = arts["comp"]
    st.dataframe(
        comp.style
            .highlight_min(subset=["MAE","RMSE","MAPE"], color="#d4edda")
            .highlight_max(subset=["R2"],                color="#d4edda")
            .format("{:.4f}"),
        use_container_width=True
    )

    if os.path.exists("plots/18_model_comparison.png"):
        st.image("plots/18_model_comparison.png", use_container_width=True)

    best = comp["R2"].idxmax()
    st.success(f"🏆 Best model by R²: **{best}**  (R² = {comp.loc[best,'R2']:.4f})")
