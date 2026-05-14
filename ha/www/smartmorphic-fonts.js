// =============================================================================
// Smartmorphic — font loader for Home Assistant
// Loaded via frontend.extra_module_url in configuration.yaml. Injects the
// Google Fonts <link> at runtime so the variable fonts are available to the
// theme's font-family declarations.
//
// Self-hosting alternative: drop .ttf files in config/www/ and replace the
// href below with /local/<filename>.ttf via @font-face rules.
// =============================================================================

(() => {
  const id = "smartmorphic-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2" +
    "?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000" +
    "&family=Outfit:wght@100..900" +
    "&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800" +
    "&display=swap";
  document.head.appendChild(link);
})();
