"""
=============================================================
 COMPLETE WEATHER FORECASTING PROJECT
 Dataset: Historical Hourly Weather Data 2012-2017 (Kaggle)
 Models : Linear Regression, Random Forest, XGBoost, ANN, LSTM, GRU
=============================================================
Run order:
  1. py main.py                   -> trains all models
  2. py -m streamlit run app.py   -> launches dashboard
"""

import warnings
warnings.filterwarnings("ignore")

import os, pickle, math
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns

from sklearn.preprocessing import MinMaxScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Keras with numpy backend (no TensorFlow needed)
os.environ["KERAS_BACKEND"] = "numpy"
import keras
from keras import layers, models, callbacks

os.makedirs("artefacts", exist_ok=True)
os.makedirs("plots",     exist_ok=True)

CITY    = "Denver"
TARGET  = "temperature"
SEED    = 42
SEQ_LEN = 24
np.random.seed(SEED)

# ─────────────────────────────────────────────────────────────
# 1. LOAD DATA
# ─────────────────────────────────────────────────────────────
print("\n📂  Loading data ...")
temp = pd.read_csv("data/temperature.csv",    parse_dates=["datetime"], index_col="datetime")
hum  = pd.read_csv("data/humidity.csv",       parse_dates=["datetime"], index_col="datetime")
pres = pd.read_csv("data/pressure.csv",       parse_dates=["datetime"], index_col="datetime")
ws   = pd.read_csv("data/wind_speed.csv",     parse_dates=["datetime"], index_col="datetime")
wd   = pd.read_csv("data/wind_direction.csv", parse_dates=["datetime"], index_col="datetime")

df = pd.DataFrame({
    "temperature"   : temp[CITY],
    "humidity"      : hum[CITY],
    "pressure"      : pres[CITY],
    "wind_speed"    : ws[CITY],
    "wind_direction": wd[CITY],
})
print(f"   City: {CITY}  |  Shape: {df.shape}")

# ─────────────────────────────────────────────────────────────
# 2. EDA
# ─────────────────────────────────────────────────────────────
print("\n📊  EDA ...")
print(df.describe())
print(f"\n   Missing values:\n{df.isnull().sum()}")

fig, axes = plt.subplots(3, 2, figsize=(16, 12))
fig.suptitle(f"EDA - {CITY} Hourly Weather", fontsize=16, fontweight="bold")
for ax, col in zip(axes.flat, df.columns):
    ax.plot(df.index, df[col], linewidth=0.5, alpha=0.8)
    ax.set_title(col.replace("_", " ").title())
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
axes.flat[-1].set_visible(False)
plt.tight_layout()
plt.savefig("plots/01_eda_timeseries.png", dpi=120)
plt.close()

fig, ax = plt.subplots(figsize=(7, 5))
sns.heatmap(df.corr(), annot=True, fmt=".2f", cmap="coolwarm", ax=ax)
ax.set_title(f"Feature Correlation - {CITY}")
plt.tight_layout()
plt.savefig("plots/02_correlation.png", dpi=120)
plt.close()
print("   EDA plots saved.")

# ─────────────────────────────────────────────────────────────
# 3. PREPROCESSING
# ─────────────────────────────────────────────────────────────
print("\n🔧  Preprocessing ...")
df = df.ffill().bfill().dropna()

# ─────────────────────────────────────────────────────────────
# 4. FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────
print("\n⚙️   Feature engineering ...")
df["hour"]        = df.index.hour
df["day_of_week"] = df.index.dayofweek
df["month"]       = df.index.month
df["day_of_year"] = df.index.dayofyear

df["hour_sin"]  = np.sin(2 * np.pi * df["hour"]        / 24)
df["hour_cos"]  = np.cos(2 * np.pi * df["hour"]        / 24)
df["month_sin"] = np.sin(2 * np.pi * df["month"]       / 12)
df["month_cos"] = np.cos(2 * np.pi * df["month"]       / 12)
df["dow_sin"]   = np.sin(2 * np.pi * df["day_of_week"] / 7)
df["dow_cos"]   = np.cos(2 * np.pi * df["day_of_week"] / 7)

for lag in [1, 3, 24, 48]:
    df[f"temp_lag_{lag}"] = df["temperature"].shift(lag)

df["temp_roll_mean_24"] = df["temperature"].rolling(24).mean()
df["temp_roll_std_24"]  = df["temperature"].rolling(24).std()

df.dropna(inplace=True)
print(f"   Final shape: {df.shape}")

# ─────────────────────────────────────────────────────────────
# 5. TRAIN / TEST SPLIT
# ─────────────────────────────────────────────────────────────
split    = int(len(df) * 0.80)
train_df = df.iloc[:split]
test_df  = df.iloc[split:]

FEATURES = [c for c in df.columns if c != TARGET]
X_train, y_train = train_df[FEATURES].values, train_df[TARGET].values
X_test,  y_test  = test_df[FEATURES].values,  test_df[TARGET].values
print(f"\n   Train: {len(train_df):,} rows  |  Test: {len(test_df):,} rows")

# ─────────────────────────────────────────────────────────────
# 6. SCALING
# ─────────────────────────────────────────────────────────────
feat_scaler   = MinMaxScaler()
target_scaler = MinMaxScaler()

X_train_sc = feat_scaler.fit_transform(X_train)
X_test_sc  = feat_scaler.transform(X_test)
y_train_sc = target_scaler.fit_transform(y_train.reshape(-1,1)).ravel()
y_test_sc  = target_scaler.transform(y_test.reshape(-1,1)).ravel()

pickle.dump(feat_scaler,   open("artefacts/feat_scaler.pkl",   "wb"))
pickle.dump(target_scaler, open("artefacts/target_scaler.pkl", "wb"))
pickle.dump(FEATURES,      open("artefacts/feature_names.pkl", "wb"))

# ─────────────────────────────────────────────────────────────
# 7. METRICS
# ─────────────────────────────────────────────────────────────
def compute_metrics(y_true, y_pred, label=""):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = math.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + 1e-8))) * 100
    if label:
        print(f"   {label:22s} -> MAE={mae:.4f}  RMSE={rmse:.4f}  R2={r2:.4f}  MAPE={mape:.2f}%")
    return dict(MAE=mae, RMSE=rmse, R2=r2, MAPE=mape)

results = {}

# ─────────────────────────────────────────────────────────────
# 8-A. LINEAR REGRESSION
# ─────────────────────────────────────────────────────────────
print("\n📈  Training Linear Regression ...")
lr = LinearRegression()
lr.fit(X_train_sc, y_train)
pred_lr = lr.predict(X_test_sc)
results["Linear Regression"] = compute_metrics(y_test, pred_lr, "Linear Regression")
pickle.dump(lr, open("artefacts/linear_regression.pkl", "wb"))

# ─────────────────────────────────────────────────────────────
# 8-B. RANDOM FOREST
# ─────────────────────────────────────────────────────────────
print("\n🌲  Training Random Forest ...")
rf = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=SEED, n_jobs=-1)
rf.fit(X_train_sc, y_train)
pred_rf = rf.predict(X_test_sc)
results["Random Forest"] = compute_metrics(y_test, pred_rf, "Random Forest")
pickle.dump(rf, open("artefacts/random_forest.pkl", "wb"))

fi = pd.Series(rf.feature_importances_, index=FEATURES).sort_values(ascending=False)
fig, ax = plt.subplots(figsize=(10, 6))
fi.head(15).plot(kind="bar", ax=ax, color="#1f77b4")
ax.set_title("Top-15 Feature Importances - Random Forest")
ax.set_ylabel("Importance")
plt.tight_layout()
plt.savefig("plots/03_feature_importance.png", dpi=120)
plt.close()

# ─────────────────────────────────────────────────────────────
# 8-C. XGBOOST
# ─────────────────────────────────────────────────────────────
print("\n🚀  Training XGBoost ...")
xgb = XGBRegressor(n_estimators=500, learning_rate=0.05, max_depth=7,
                   subsample=0.8, colsample_bytree=0.8, random_state=SEED,
                   early_stopping_rounds=30, eval_metric="rmse", verbosity=0)
xgb.fit(X_train_sc, y_train, eval_set=[(X_test_sc, y_test)], verbose=False)
pred_xgb = xgb.predict(X_test_sc)
results["XGBoost"] = compute_metrics(y_test, pred_xgb, "XGBoost")
pickle.dump(xgb, open("artefacts/xgboost.pkl", "wb"))

# ─────────────────────────────────────────────────────────────
# SEQUENCE BUILDER for RNN / LSTM / GRU
# ─────────────────────────────────────────────────────────────
def build_sequences(X, y, seq_len=SEQ_LEN):
    Xs, ys = [], []
    for i in range(seq_len, len(X)):
        Xs.append(X[i-seq_len:i])
        ys.append(y[i])
    return np.array(Xs, dtype=np.float32), np.array(ys, dtype=np.float32)

print("\n🔢  Building sequences ...")
Xtr_seq, ytr_seq = build_sequences(X_train_sc, y_train_sc)
Xte_seq, yte_seq = build_sequences(X_test_sc,  y_test_sc)
n_feat = X_train_sc.shape[1]
print(f"   Train seq: {Xtr_seq.shape}  |  Test seq: {Xte_seq.shape}")

es = callbacks.EarlyStopping(patience=5, restore_best_weights=True, verbose=0)

def seq_predict(model, Xte, yte):
    pred_sc = model.predict(Xte, verbose=0).ravel()
    pred    = target_scaler.inverse_transform(pred_sc.reshape(-1,1)).ravel()
    y_true  = target_scaler.inverse_transform(yte.reshape(-1,1)).ravel()
    return y_true, pred

# ─────────────────────────────────────────────────────────────
# 8-D. ANN
# ─────────────────────────────────────────────────────────────
print("\n🧠  Training ANN ...")
ann = models.Sequential([
    layers.Input(shape=(n_feat,)),
    layers.Dense(256, activation="relu"),
    layers.Dropout(0.2),
    layers.Dense(128, activation="relu"),
    layers.Dropout(0.2),
    layers.Dense(64,  activation="relu"),
    layers.Dense(1)
])
ann.compile(optimizer="adam", loss="mse")
ann.fit(X_train_sc, y_train_sc, validation_split=0.1,
        epochs=50, batch_size=256, callbacks=[es], verbose=0)
pred_ann_sc = ann.predict(X_test_sc, verbose=0).ravel()
pred_ann    = target_scaler.inverse_transform(pred_ann_sc.reshape(-1,1)).ravel()
results["ANN"] = compute_metrics(y_test, pred_ann, "ANN")
ann.save("artefacts/ann.keras")

# ─────────────────────────────────────────────────────────────
# 8-E. SIMPLE RNN
# ─────────────────────────────────────────────────────────────
print("\n🔃  Training Simple RNN ...")
rnn = models.Sequential([
    layers.Input(shape=(SEQ_LEN, n_feat)),
    layers.SimpleRNN(128, return_sequences=True),
    layers.Dropout(0.2),
    layers.SimpleRNN(64),
    layers.Dropout(0.2),
    layers.Dense(32, activation="relu"),
    layers.Dense(1)
])
rnn.compile(optimizer="adam", loss="mse")
rnn.fit(Xtr_seq, ytr_seq, validation_split=0.1,
        epochs=30, batch_size=256, callbacks=[es], verbose=0)
y_true_seq, pred_rnn = seq_predict(rnn, Xte_seq, yte_seq)
results["RNN"] = compute_metrics(y_true_seq, pred_rnn, "RNN")
rnn.save("artefacts/rnn.keras")

# ─────────────────────────────────────────────────────────────
# 8-F. LSTM
# ─────────────────────────────────────────────────────────────
print("\n🔁  Training LSTM ...")
lstm = models.Sequential([
    layers.Input(shape=(SEQ_LEN, n_feat)),
    layers.LSTM(128, return_sequences=True),
    layers.Dropout(0.2),
    layers.LSTM(64),
    layers.Dropout(0.2),
    layers.Dense(32, activation="relu"),
    layers.Dense(1)
])
lstm.compile(optimizer="adam", loss="mse")
lstm.fit(Xtr_seq, ytr_seq, validation_split=0.1,
         epochs=30, batch_size=256, callbacks=[es], verbose=0)
_, pred_lstm = seq_predict(lstm, Xte_seq, yte_seq)
results["LSTM"] = compute_metrics(y_true_seq, pred_lstm, "LSTM")
lstm.save("artefacts/lstm.keras")

# ─────────────────────────────────────────────────────────────
# 8-G. GRU
# ─────────────────────────────────────────────────────────────
print("\n🔄  Training GRU ...")
gru = models.Sequential([
    layers.Input(shape=(SEQ_LEN, n_feat)),
    layers.GRU(128, return_sequences=True),
    layers.Dropout(0.2),
    layers.GRU(64),
    layers.Dropout(0.2),
    layers.Dense(32, activation="relu"),
    layers.Dense(1)
])
gru.compile(optimizer="adam", loss="mse")
gru.fit(Xtr_seq, ytr_seq, validation_split=0.1,
        epochs=30, batch_size=256, callbacks=[es], verbose=0)
_, pred_gru = seq_predict(gru, Xte_seq, yte_seq)
results["GRU"] = compute_metrics(y_true_seq, pred_gru, "GRU")
gru.save("artefacts/gru.keras")

# ─────────────────────────────────────────────────────────────
# 9. MODEL COMPARISON
# ─────────────────────────────────────────────────────────────
print("\n\n📋  MODEL COMPARISON")
comp = pd.DataFrame(results).T[["MAE","RMSE","R2","MAPE"]]
comp.index.name = "Model"
print(comp.round(4).to_string())
comp.to_csv("artefacts/model_comparison.csv")

# ─────────────────────────────────────────────────────────────
# 10. PLOTS
# ─────────────────────────────────────────────────────────────
print("\n🖼️   Saving plots ...")
PLOT_N     = 500
y_test_arr = y_test

def plot_actual_vs_pred(y_true, y_pred, title, fname, n=PLOT_N):
    fig, ax = plt.subplots(figsize=(14, 4))
    ax.plot(y_true[:n], label="Actual",    linewidth=1.2)
    ax.plot(y_pred[:n], label="Predicted", linewidth=1.0, alpha=0.8)
    ax.set_title(title); ax.set_ylabel("Temperature (K)")
    ax.legend(); ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(f"plots/{fname}", dpi=120); plt.close()

def plot_residuals(y_true, y_pred, title, fname):
    resid = y_true - y_pred
    fig, axes = plt.subplots(1, 2, figsize=(14, 4))
    axes[0].plot(resid[:PLOT_N], linewidth=0.8, color="tomato")
    axes[0].axhline(0, color="k", linewidth=0.8)
    axes[0].set_title(f"Residuals - {title}"); axes[0].set_ylabel("Error (K)")
    axes[1].hist(resid, bins=60, color="steelblue", edgecolor="white")
    axes[1].set_title("Residual Distribution")
    plt.tight_layout(); plt.savefig(f"plots/{fname}", dpi=120); plt.close()

plot_actual_vs_pred(y_test_arr, pred_lr,   "Linear Regression - Actual vs Predicted", "04_lr_pred.png")
plot_residuals(y_test_arr,      pred_lr,   "Linear Regression", "05_lr_resid.png")
plot_actual_vs_pred(y_test_arr, pred_rf,   "Random Forest - Actual vs Predicted",     "06_rf_pred.png")
plot_residuals(y_test_arr,      pred_rf,   "Random Forest", "07_rf_resid.png")
plot_actual_vs_pred(y_test_arr, pred_xgb,  "XGBoost - Actual vs Predicted",           "08_xgb_pred.png")
plot_residuals(y_test_arr,      pred_xgb,  "XGBoost", "09_xgb_resid.png")
plot_actual_vs_pred(y_test_arr, pred_ann,  "ANN - Actual vs Predicted",               "10_ann_pred.png")
plot_residuals(y_test_arr,      pred_ann,  "ANN", "11_ann_resid.png")
plot_actual_vs_pred(y_true_seq, pred_rnn,  "RNN - Actual vs Predicted",               "12_rnn_pred.png")
plot_residuals(y_true_seq,      pred_rnn,  "RNN", "13_rnn_resid.png")
plot_actual_vs_pred(y_true_seq, pred_lstm, "LSTM - Actual vs Predicted",              "14_lstm_pred.png")
plot_residuals(y_true_seq,      pred_lstm, "LSTM", "15_lstm_resid.png")
plot_actual_vs_pred(y_true_seq, pred_gru,  "GRU - Actual vs Predicted",               "16_gru_pred.png")
plot_residuals(y_true_seq,      pred_gru,  "GRU", "17_gru_resid.png")

fig, axes = plt.subplots(1, 3, figsize=(18, 5))
for ax, metric in zip(axes, ["MAE", "RMSE", "R2"]):
    comp[metric].plot(kind="bar", ax=ax, color="steelblue", edgecolor="white")
    ax.set_title(metric); ax.set_xticklabels(comp.index, rotation=30, ha="right")
    ax.grid(axis="y", alpha=0.3)
plt.suptitle("Model Comparison", fontsize=14, fontweight="bold")
plt.tight_layout()
plt.savefig("plots/18_model_comparison.png", dpi=120); plt.close()

# ─────────────────────────────────────────────────────────────
# 11. SAVE FOR STREAMLIT
# ─────────────────────────────────────────────────────────────
np.save("artefacts/y_test.npy",     y_test_arr)
np.save("artefacts/y_test_seq.npy", y_true_seq)
np.save("artefacts/pred_lr.npy",    pred_lr)
np.save("artefacts/pred_rf.npy",    pred_rf)
np.save("artefacts/pred_xgb.npy",   pred_xgb)
np.save("artefacts/pred_ann.npy",   pred_ann)
np.save("artefacts/pred_rnn.npy",   pred_rnn)
np.save("artefacts/pred_lstm.npy",  pred_lstm)
np.save("artefacts/pred_gru.npy",   pred_gru)
test_df.to_csv("artefacts/test_df.csv")

print("\n✅  Training complete! All 7 models saved.")
print("   Now run:  py -m streamlit run app.py")
