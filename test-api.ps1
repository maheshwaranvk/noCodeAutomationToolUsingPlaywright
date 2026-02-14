$body = @{
    featureText = "Feature: Test
  Scenario: Simple test
    Given I navigate to LeafTaps application
    When I enter username as Democsr2
    Then I see the password field"
    retryCount = 1
    url = "http://leaftaps.com/opentaps/control/main"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3001/execute" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180

Write-Host "Response Status: $($response.StatusCode)"
$result = $response.Content | ConvertFrom-Json
Write-Host "Artifacts Count: $($result.artifacts.Length)"
Write-Host "Status: $($result.status)"
foreach ($artifact in $result.artifacts) {
    Write-Host "  - $($artifact.type): $($artifact.filename)"
}
