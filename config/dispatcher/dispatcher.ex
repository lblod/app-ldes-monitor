defmodule Dispatcher do
  use Matcher

  define_accept_types(
    json: ["application/json", "application/vnd.api+json"],
    html: ["text/html", "application/xhtml+html"],
    sparql: ["application/sparql-results+json"],
    any: ["*/*"]
  )

  define_layers([:static, :sparql, :api_services, :frontend_fallback, :resources, :not_found])

  options "/*path", _ do
    conn
    |> Plug.Conn.put_resp_header("access-control-allow-headers", "content-type,accept")
    |> Plug.Conn.put_resp_header("access-control-allow-methods", "*")
    |> send_resp(200, "{ \"message\": \"ok\" }")
  end

  ###############
  # STATIC
  ###############

  # self-service
  match "/index.html", %{layer: :static} do
    forward(conn, [], "http://frontend/index.html")
  end

  get "/assets/*path", %{layer: :static} do
    forward(conn, path, "http://frontend/assets/")
  end

  get "/@appuniversum/*path", %{layer: :static} do
    forward(conn, path, "http://frontend/@appuniversum/")
  end

  get "/@embroider/@appuniversum/*path", %{layer: :static} do
    forward(conn, path, "http://frontend/@appuniversum/")
  end

  get "/@embroider/*path", %{layer: :static} do
    forward(conn, path, "http://frontend/@embroider/")
  end

  #################
  # FRONTEND PAGES
  #################

  # self-service
  match "/*path", %{layer: :frontend_fallback, accept: %{html: true}} do
    # we don't forward the path, because the app should take care of this in the browser.
    forward(conn, [], "http://frontend/index.html")
  end


  match "/ldes-watchman-api/*path", %{layer: :api_services, accept: %{any: true}} do
    forward(conn, path, "http://ldes-monitor/")
  end

  #################
  # NOT FOUND
  #################
  match "/*_path", %{layer: :not_found} do
    send_resp(conn, 404, "Route not found.  See config/dispatcher.ex")
  end
end
