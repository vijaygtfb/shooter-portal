// Local development defaults. The CI/CD pipeline replaces this file per environment.
window.__APP_CONFIG__ = {
  envName: "local",
  apiBaseUrl: "http://localhost:8000",
  logLevel: "debug",
  // Demo mode: every API call is answered by the in-browser mock server (src/mocks/) with dummy data.
  // Set to false once the FastAPI backend is available.
  useMockApi: true,
  associationName: "District Shooting Association",
};
