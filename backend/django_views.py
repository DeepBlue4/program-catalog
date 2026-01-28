### Example View

# Logic located in views.py file
def vue_app_view(request):
    # Read the built index.html and serve it
    static_dir = os.path.join(settings.BASE_DIR, "static/program-catalog-app")
    # Get the actual filenames from the manifest or directory
    assets_dir = os.path.join(static_dir, "assets")
    css_files = [f for f in os.listdir(assets_dir) if f.endswith(".css")]
    js_files = [f for f in os.listdir(assets_dir) if f.endswith(".js")]

    return render(
        request,
        "program-catalog-app/vue_app_dynamic.html",
        {
            "css_files": css_files,
            "js_files": js_files,
        },
    )