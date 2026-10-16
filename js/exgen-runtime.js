const PRODUCTION_HOSTS = new Set(["exgen.se"]);
const productionOrigin = location.protocol === "https:" &&
  PRODUCTION_HOSTS.has(location.hostname.toLowerCase().replace(/\.$/, ""));

const productionConfig = {
  environment: "production",
  projectRef: "mnmotdluigzeehdjbhbu",
  supabaseUrl: "https://mnmotdluigzeehdjbhbu.supabase.co",
  publishableKey: "sb_publishable_T541A0HFXsw0zQRAhIy0kA_x0hcsfVN",
  appOrigin: "https://exgen.se",
  authStorageKey: "sb-mnmotdluigzeehdjbhbu-auth-token",
};

const unconfiguredConfig = {
  environment: "unconfigured",
  projectRef: "",
  supabaseUrl: "",
  publishableKey: "",
  appOrigin: "",
  authStorageKey: "",
};

window.ExGenRuntime = Object.freeze(productionOrigin ? productionConfig : unconfiguredConfig);
