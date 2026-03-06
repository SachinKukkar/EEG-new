import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from sklearn.metrics import roc_curve, auc, confusion_matrix, precision_recall_curve, matthews_corrcoef, cohen_kappa_score
import pandas as pd

class MetricsVisualizer:
    def calculate_authentication_metrics(self, y_true, y_scores, threshold=0.90):
        y_pred = (y_scores >= threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        
        far = fp / (fp + tn) if (fp + tn) > 0 else 0
        frr = fn / (fn + tp) if (fn + tp) > 0 else 0
        accuracy = (tp + tn) / (tp + tn + fp + fn)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        f2_score = 5 * (precision * recall) / (4 * precision + recall) if (4 * precision + recall) > 0 else 0
        
        fpr, tpr, thresholds = roc_curve(y_true, y_scores)
        fnr = 1 - tpr
        eer_idx = np.nanargmin(np.absolute((fnr - fpr)))
        eer = fpr[eer_idx]
        eer_threshold = thresholds[eer_idx]
        roc_auc = auc(fpr, tpr)
        
        precision_curve, recall_curve, _ = precision_recall_curve(y_true, y_scores)
        pr_auc = auc(recall_curve, precision_curve)
        
        balanced_accuracy = (recall + specificity) / 2
        g_mean = np.sqrt(recall * specificity)
        
        npv = tn / (tn + fn) if (tn + fn) > 0 else 0
        fdr = fp / (fp + tp) if (fp + tp) > 0 else 0
        fnr_rate = fn / (fn + tp) if (fn + tp) > 0 else 0
        fpr_rate = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        return {
            'FAR': far, 'FRR': frr, 'EER': eer, 'EER_Threshold': eer_threshold,
            'Accuracy': accuracy, 'Balanced_Accuracy': balanced_accuracy,
            'Precision': precision, 'Recall': recall, 'Specificity': specificity,
            'F1_Score': f1_score, 'F2_Score': f2_score, 'AUC': roc_auc, 'PR_AUC': pr_auc,
            'G_Mean': g_mean,
            'NPV': npv, 'FDR': fdr, 'FNR': fnr_rate, 'FPR': fpr_rate,
            'TP': int(tp), 'TN': int(tn), 'FP': int(fp), 'FN': int(fn),
            'fpr': fpr, 'tpr': tpr, 'thresholds': thresholds,
            'precision_curve': precision_curve, 'recall_curve': recall_curve
        }
    
    def plot_roc_curve(self, metrics):
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=metrics['fpr'], y=metrics['tpr'], mode='lines',
            name=f'ROC (AUC={metrics["AUC"]:.3f})', line=dict(color='#2E86DE', width=3)))
        fig.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode='lines',
            name='Random', line=dict(color='gray', width=2, dash='dash')))
        eer_idx = np.nanargmin(np.absolute((1 - metrics['tpr']) - metrics['fpr']))
        fig.add_trace(go.Scatter(x=[metrics['fpr'][eer_idx]], y=[metrics['tpr'][eer_idx]],
            mode='markers', name=f'EER ({metrics["EER"]:.3f})',
            marker=dict(color='red', size=12, symbol='star')))
        fig.update_layout(title='ROC Curve', xaxis_title='False Positive Rate',
            yaxis_title='True Positive Rate', template='plotly_white', height=500)
        return fig
    
    def plot_confusion_matrix(self, metrics):
        cm = np.array([[metrics['TN'], metrics['FP']], [metrics['FN'], metrics['TP']]])
        fig = go.Figure(data=go.Heatmap(z=cm,
            x=['Predicted Reject', 'Predicted Accept'],
            y=['Actual Reject', 'Actual Accept'],
            text=cm, texttemplate='%{text}', textfont={"size": 20},
            colorscale='Blues', showscale=True))
        fig.update_layout(title='Confusion Matrix', height=400, template='plotly_white')
        return fig
    
    def plot_metrics_gauge(self, metrics):
        fig = make_subplots(rows=2, cols=2,
            specs=[[{'type': 'indicator'}, {'type': 'indicator'}],
                   [{'type': 'indicator'}, {'type': 'indicator'}]])
        
        fig.add_trace(go.Indicator(mode="gauge+number", value=metrics['Accuracy']*100,
            title={'text': "Accuracy (%)"}, gauge={'axis': {'range': [0, 100]},
            'bar': {'color': "#2E86DE"}}), row=1, col=1)
        fig.add_trace(go.Indicator(mode="gauge+number", value=metrics['Precision']*100,
            title={'text': "Precision (%)"}, gauge={'bar': {'color': "#10AC84"}}), row=1, col=2)
        fig.add_trace(go.Indicator(mode="gauge+number", value=metrics['Recall']*100,
            title={'text': "Recall (%)"}, gauge={'bar': {'color': "#EE5A6F"}}), row=2, col=1)
        fig.add_trace(go.Indicator(mode="gauge+number", value=metrics['F1_Score']*100,
            title={'text': "F1 Score (%)"}, gauge={'bar': {'color': "#FD79A8"}}), row=2, col=2)
        
        fig.update_layout(height=600, template='plotly_white')
        return fig
    
    def plot_error_rates(self, metrics):
        fig = go.Figure(data=[go.Bar(
            x=['FAR', 'FRR', 'EER'],
            y=[metrics['FAR']*100, metrics['FRR']*100, metrics['EER']*100],
            marker_color=['#EE5A6F', '#2E86DE', '#FD79A8'],
            text=[f'{metrics["FAR"]*100:.3f}%', f'{metrics["FRR"]*100:.3f}%', f'{metrics["EER"]*100:.3f}%'],
            textposition='auto')])
        fig.update_layout(title='Error Rates', yaxis_title='Error Rate (%)',
            template='plotly_white', height=400)
        return fig
    
    def plot_far_frr_vs_threshold(self, metrics):
        fnr = 1 - metrics['tpr']
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=metrics['thresholds'], y=metrics['fpr'],
            mode='lines', name='FAR', line=dict(color='#EE5A6F', width=3)))
        fig.add_trace(go.Scatter(x=metrics['thresholds'], y=fnr,
            mode='lines', name='FRR', line=dict(color='#2E86DE', width=3)))
        fig.add_vline(x=metrics['EER_Threshold'], line_dash="dash", line_color="red",
            annotation_text=f"EER: {metrics['EER_Threshold']:.3f}")
        fig.update_layout(title='FAR/FRR vs Threshold', xaxis_title='Threshold',
            yaxis_title='Error Rate', template='plotly_white', height=500)
        return fig
    
    def plot_precision_recall_curve(self, metrics):
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=metrics['recall_curve'], y=metrics['precision_curve'],
            mode='lines', name=f'PR Curve (AUC={metrics["PR_AUC"]:.3f})',
            line=dict(color='#10AC84', width=3), fill='tozeroy'))
        fig.update_layout(title='Precision-Recall Curve', xaxis_title='Recall',
            yaxis_title='Precision', template='plotly_white', height=500)
        return fig
    
    def plot_det_curve(self, metrics):
        fnr = 1 - metrics['tpr']
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=metrics['fpr']*100, y=fnr*100, mode='lines',
            name='DET Curve', line=dict(color='#EE5A6F', width=3)))
        eer_idx = np.nanargmin(np.absolute(fnr - metrics['fpr']))
        fig.add_trace(go.Scatter(x=[metrics['fpr'][eer_idx]*100], y=[fnr[eer_idx]*100],
            mode='markers', name=f'EER ({metrics["EER"]*100:.2f}%)',
            marker=dict(color='red', size=12, symbol='star')))
        fig.update_layout(title='DET Curve (Detection Error Tradeoff)',
            xaxis_title='False Accept Rate (%)', yaxis_title='False Reject Rate (%)',
            template='plotly_white', height=500)
        return fig
    
    def plot_advanced_metrics(self, metrics):
        fig = go.Figure(data=[go.Bar(
            x=['G-Mean', 'Balanced Acc', 'Specificity'],
            y=[metrics['G_Mean'], metrics['Balanced_Accuracy'], metrics['Specificity']],
            marker_color=['#FDCB6E', '#74B9FF', '#55EFC4'],
            text=[f"{metrics['G_Mean']:.3f}", f"{metrics['Balanced_Accuracy']:.3f}",
                  f"{metrics['Specificity']:.3f}"],
            textposition='auto')])
        fig.update_layout(title='Advanced Performance Metrics', yaxis_title='Score',
            yaxis_range=[0, 1], template='plotly_white', height=400)
        return fig
    
    def plot_all_error_rates(self, metrics):
        fig = go.Figure(data=[go.Bar(
            x=['FAR', 'FRR', 'EER', 'FDR', 'FNR', 'FPR'],
            y=[metrics['FAR']*100, metrics['FRR']*100, metrics['EER']*100,
               metrics['FDR']*100, metrics['FNR']*100, metrics['FPR']*100],
            marker_color=['#EE5A6F', '#2E86DE', '#FD79A8', '#FDCB6E', '#A29BFE', '#55EFC4'],
            text=[f"{metrics['FAR']*100:.2f}%", f"{metrics['FRR']*100:.2f}%",
                  f"{metrics['EER']*100:.2f}%", f"{metrics['FDR']*100:.2f}%",
                  f"{metrics['FNR']*100:.2f}%", f"{metrics['FPR']*100:.2f}%"],
            textposition='auto')])
        fig.update_layout(title='Comprehensive Error Rate Analysis',
            yaxis_title='Error Rate (%)', template='plotly_white', height=400)
        return fig
    
    def plot_metrics_comparison(self, metrics):
        metric_names = ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'Specificity']
        metric_values = [metrics['Accuracy']*100, metrics['Precision']*100,
                        metrics['Recall']*100, metrics['F1_Score']*100, metrics['Specificity']*100]
        colors = ['#2E86DE', '#10AC84', '#EE5A6F', '#FD79A8', '#A29BFE']
        
        fig = go.Figure(data=[go.Bar(x=metric_names, y=metric_values, marker_color=colors,
            text=[f'{v:.2f}%' for v in metric_values], textposition='auto')])
        fig.update_layout(title='Performance Metrics Comparison', yaxis_title='Score (%)',
            yaxis_range=[0, 100], template='plotly_white', height=400)
        return fig
    
    def generate_metrics_summary(self, metrics):
        return pd.DataFrame({
            'Metric': ['Accuracy', 'Balanced Accuracy', 'Precision', 'Recall', 'Specificity',
                      'F1 Score', 'F2 Score', 'AUC-ROC', 'AUC-PR',
                      'G-Mean', 'NPV',
                      'FAR', 'FRR', 'EER', 'FDR', 'EER Threshold',
                      'TP', 'TN', 'FP', 'FN'],
            'Value': [f"{metrics['Accuracy']:.4f} ({metrics['Accuracy']*100:.2f}%)",
                     f"{metrics['Balanced_Accuracy']:.4f} ({metrics['Balanced_Accuracy']*100:.2f}%)",
                     f"{metrics['Precision']:.4f} ({metrics['Precision']*100:.2f}%)",
                     f"{metrics['Recall']:.4f} ({metrics['Recall']*100:.2f}%)",
                     f"{metrics['Specificity']:.4f} ({metrics['Specificity']*100:.2f}%)",
                     f"{metrics['F1_Score']:.4f} ({metrics['F1_Score']*100:.2f}%)",
                     f"{metrics['F2_Score']:.4f} ({metrics['F2_Score']*100:.2f}%)",
                     f"{metrics['AUC']:.4f}", f"{metrics['PR_AUC']:.4f}",
                     f"{metrics['G_Mean']:.4f}", f"{metrics['NPV']:.4f}",
                     f"{metrics['FAR']:.4f} ({metrics['FAR']*100:.2f}%)",
                     f"{metrics['FRR']:.4f} ({metrics['FRR']*100:.2f}%)",
                     f"{metrics['EER']:.4f} ({metrics['EER']*100:.2f}%)",
                     f"{metrics['FDR']:.4f} ({metrics['FDR']*100:.2f}%)",
                     f"{metrics['EER_Threshold']:.4f}",
                     f"{metrics['TP']}", f"{metrics['TN']}",
                     f"{metrics['FP']}", f"{metrics['FN']}"]
        })

def evaluate_real_model():
    """Evaluate the trained model on deterministic real holdout EEG data."""
    import torch
    import joblib
    from pathlib import Path
    from model_management import load_production_model
    
    BASE_DIR = Path(__file__).parent.absolute()
    ASSETS_DIR = BASE_DIR / 'assets'
    MODEL_PATH = ASSETS_DIR / 'model.pth'
    ENCODER_PATH = ASSETS_DIR / 'label_encoder.joblib'
    SCALER_PATH = ASSETS_DIR / 'scaler.joblib'
    USERS_PATH = ASSETS_DIR / 'users.json'
    
    # Check if model exists
    if not MODEL_PATH.exists() or not ENCODER_PATH.exists() or not SCALER_PATH.exists():
        return None, "Model not trained. Please train the model first."
    
    # Check if users exist
    if not USERS_PATH.exists():
        return None, "No users registered. Please register users first."
    
    try:
        import json
        with open(USERS_PATH, 'r') as f:
            users = json.load(f)
        
        if len(users) < 2:
            return None, "Need at least 2 users for evaluation."
        
        # Build a deterministic real holdout set from each user's stored EEG segments.
        # We avoid random splitting and use the final 20% of each user's segments as test data.
        test_data, test_labels = [], []
        for username in users:
            user_data_path = ASSETS_DIR / f'data_{username}.npy'
            if user_data_path.exists():
                user_data = np.load(user_data_path)
                if len(user_data) >= 5:
                    split_idx = max(1, int(len(user_data) * 0.8))
                    user_test = user_data[split_idx:]
                    if len(user_test) > 0:
                        test_data.append(user_test)
                        test_labels.extend([username] * len(user_test))
        
        if len(test_data) < 2:
            return None, "Not enough real holdout data for evaluation."
        
        X_test = np.concatenate(test_data)
        y_test = np.array(test_labels)
        
        # Load preprocessing
        scaler = joblib.load(SCALER_PATH)
        encoder = joblib.load(ENCODER_PATH)
        
        # Scale features
        X_reshaped = X_test.reshape(-1, X_test.shape[-1])
        X_test_scaled = scaler.transform(X_reshaped).reshape(X_test.shape)
        y_test_encoded = encoder.transform(y_test)
        
        # Load model
        model, device = load_production_model(str(MODEL_PATH), num_classes=len(encoder.classes_))
        
        # Get predictions
        y_true_binary = []
        y_scores = []
        
        with torch.inference_mode():
            for sample, true_label in zip(X_test_scaled, y_test_encoded):
                sample_tensor = torch.tensor(sample, dtype=torch.float32).unsqueeze(0).to(device)
                outputs = model(sample_tensor)
                probabilities = torch.nn.functional.softmax(outputs, dim=1)
                
                # Get confidence for the true class
                confidence = probabilities[0, true_label].item()
                y_scores.append(confidence)
                
                # Binary: 1 if predicted correctly, 0 otherwise
                predicted_label = torch.argmax(probabilities, dim=1).item()
                y_true_binary.append(1 if predicted_label == true_label else 0)
        
        return (np.array(y_true_binary), np.array(y_scores)), None
        
    except Exception as e:
        return None, f"Error evaluating model: {str(e)}"
