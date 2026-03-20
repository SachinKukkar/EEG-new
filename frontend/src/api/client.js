import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// Create axios instance with longer timeout for Render cold starts
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180000, // 3 minutes for training tasks
});

/**
 * Retry logic for handling Render cold starts and temporary failures
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms for exponential backoff
 * @returns {Function} Axios response interceptor
 */
function getRetryInterceptor(maxRetries = 3, baseDelay = 1000) {
  return async (error) => {
    const config = error.config;

    // Don't retry if request was already retried or if it's not a network/timeout error
    if (!config || config.__retryCount === undefined) {
      config.__retryCount = 0;
    }

    // Only retry GET requests or specific POST endpoints (not file uploads)
    const isRetryableMethod = config.method === "get";
    const isRetryableEndpoint =
      config.url.includes("/api/health") ||
      config.url.includes("/api/dashboard") ||
      config.url.includes("/api/users") ||
      config.url.includes("/api/model/status") ||
      config.url.includes("/api/auth-logs") ||
      config.url.includes("/api/metrics");

    const isRetryable =
      isRetryableMethod ||
      (isRetryableEndpoint && config.method === "get");

    const isNetworkError =
      error.code === "ECONNABORTED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ERR_NETWORK" ||
      !error.response;

    if (isRetryable && isNetworkError && config.__retryCount < maxRetries) {
      config.__retryCount++;
      const delay = baseDelay * Math.pow(2, config.__retryCount - 1);
      console.warn(
        `⚠️ API unreachable, retry ${config.__retryCount}/${maxRetries} in ${delay}ms: ${config.url}`
      );
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api.request(config);
    }

    return Promise.reject(error);
  };
}

// Add response interceptor for retry logic
api.interceptors.response.use(
  (response) => response,
  getRetryInterceptor(3, 1000)
);

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`📤 API Request: ${config.method.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for logging success
api.interceptors.response.use(
  (response) => {
    console.log(
      `✅ API Response: ${response.status} ${response.config.url}`
    );
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(
        `❌ API Error: ${error.response.status} ${error.config.url} - ${
          error.response.data?.detail || error.message
        }`
      );
    } else {
      console.error(`❌ Network Error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Validate backend health before making critical API calls
 * @throws {Error} If backend is not reachable or unhealthy
 */
export async function validateBackendHealth() {
  try {
    const health = await api.get("/api/health", { timeout: 5000 });
    if (health.data?.status !== "ok") {
      throw new Error("Backend reported unhealthy status");
    }
    console.log("✅ Backend health: OK");
    return health.data;
  } catch (error) {
    const message = `Backend unreachable at ${BASE_URL}: ${
      error.response?.data?.detail || error.message
    }`;
    console.error(`❌ ${message}`);
    throw new Error(message);
  }
}

export async function getHealth() {
  try {
    const { data } = await api.get("/api/health");
    return data;
  } catch (error) {
    console.error("Health check failed:", error.message);
    throw new Error(
      `Health check failed: ${error.response?.data?.detail || error.message}`
    );
  }
}

export async function getUsers() {
  try {
    const { data } = await api.get("/api/users");
    return data.users;
  } catch (error) {
    throw new Error(
      `Failed to fetch users: ${error.response?.data?.detail || error.message}`
    );
  }
}

export async function registerUser(payload) {
  try {
    const { data } = await api.post("/api/users/register", payload);
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail ||
      error.message ||
      "Registration failed";
    throw new Error(detail);
  }
}

export async function deleteUser(username) {
  try {
    const { data } = await api.delete(
      `/api/users/${encodeURIComponent(username)}`
    );
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail || error.message || "Delete failed";
    throw new Error(detail);
  }
}

export async function trainModel() {
  try {
    const { data } = await api.post("/api/model/train");
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail ||
      error.message ||
      "Training failed. Please ensure backend is running.";
    throw new Error(detail);
  }
}

export async function authenticateUser({
  file,
  username,
  subjectId,
  threshold,
}) {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("username", username);
    form.append("subject_id", String(subjectId));
    form.append("threshold", String(threshold));

    const { data } = await api.post("/api/authenticate", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail ||
      error.message ||
      "Authentication failed";
    throw new Error(detail);
  }
}

export async function getDashboard() {
  try {
    const { data } = await api.get("/api/dashboard");
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail || error.message || "Dashboard failed";
    throw new Error(detail);
  }
}

export async function getMetrics(threshold = 0.9) {
  try {
    const { data } = await api.get("/api/metrics", { params: { threshold } });
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail ||
      error.message ||
      "Metrics evaluation failed";
    throw new Error(detail);
  }
}

export async function getModelStatus() {
  try {
    const { data } = await api.get("/api/model/status");
    return data;
  } catch (error) {
    const detail =
      error.response?.data?.detail ||
      error.message ||
      "Model status check failed";
    throw new Error(detail);
  }
}

export async function getAuthLogs(limit = 50) {
  try {
    const { data } = await api.get("/api/auth-logs", { params: { limit } });
    return data.logs;
  } catch (error) {
    console.warn("Could not fetch auth logs:", error.message);
    return []; // Graceful fallback
  }
}
