$body = Get-Content -Raw -Path "payload.json"
$response = Invoke-RestMethod -Uri "http://localhost:3001/execute" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 300
Write-Host "Status: $($response.status)"
Write-Host "Artifacts count: $($response.artifacts.Count)"
$response | ConvertTo-Json -Depth 5 | Out-File -FilePath "last-response.json"
Write-Host "Saved full response to last-response.json"