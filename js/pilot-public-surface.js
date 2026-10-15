(function () {
  var runtime = window.ExGenRuntime || {};
  document.documentElement.setAttribute("data-exgen-environment", runtime.environment || "unconfigured");
  if (runtime.environment !== "pilot") return;

  function updatePilotMetadata() {
    document.title = "ExGen skolpilot";
    var description = "ExGen skolpilot är endast tillgänglig för elever med ett inbjudet testkonto.";
    [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', "ExGen · Skolpilot"],
      ['meta[property="og:description"]', description],
      ['meta[property="og:url"]', location.origin + location.pathname],
      ['meta[name="twitter:title"]', "ExGen · Skolpilot"],
      ['meta[name="twitter:description"]', description],
    ].forEach(function (entry) {
      var element = document.querySelector(entry[0]);
      if (element) element.setAttribute("content", entry[1]);
    });

    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";
    document.querySelectorAll('link[rel="canonical"], script[type="application/ld+json"]').forEach(function (element) {
      element.remove();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updatePilotMetadata, { once: true });
  } else {
    updatePilotMetadata();
  }
})();
