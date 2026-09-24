param([Parameter(Mandatory = $true)][string]$ProjectId, [string]$Region = "europe-central2", [string]$Service = "mythos-editorial-registry", [string]$SecretName = "mythos-registry-api-key")
$ErrorActionPreference = "Stop"
if ($ProjectId -eq "studio-2985968119-3ca85") { throw "Refusing to deploy into the production Firebase project." }
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw "Google Cloud CLI is not installed." }
if (-not (Test-Path -LiteralPath "content-registry/generated/registry.json")) { throw "Run npm run registry:build first." }
gcloud run deploy $Service --project $ProjectId --region $Region --source . --allow-unauthenticated --max-instances 2 --memory 512Mi --cpu 1 --set-env-vars "REQUIRE_API_KEY=true,REGISTRY_HOST=0.0.0.0" --set-secrets "REGISTRY_API_KEY=${SecretName}:latest"
$serviceUrl = gcloud run services describe $Service --project $ProjectId --region $Region --format "value(status.url)"
if (-not $serviceUrl) { throw "Cloud Run did not return a service URL." }
gcloud run services update $Service --project $ProjectId --region $Region --update-env-vars "PUBLIC_BASE_URL=$serviceUrl" | Out-Null
Write-Host "GPT Action OpenAPI: $serviceUrl/openapi.json"
