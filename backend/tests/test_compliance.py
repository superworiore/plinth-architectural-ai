"""Compliance engine tests."""


def test_run_compliance_no_plot_data(client, auth_headers, test_project):
    pid = test_project["id"]
    response = client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "checks" in data
    assert "passing" in data
    assert "failing" in data
    assert "in_review" in data
    # With no plot data, everything should be in_review
    assert data["passing"] == 0
    assert data["in_review"] > 0


def test_run_compliance_with_valid_plot_data(client, auth_headers, test_project):
    pid = test_project["id"]
    # Set complete plot data
    client.patch(f"/api/projects/{pid}", json={
        "plot_data": {
            "width": 12.19,
            "length": 18.29,
            "area": 222.9,
            "setbacks": {"front": 3.0, "rear": 1.5, "side1": 1.5, "side2": 1.5},
            "max_far": 1.75,
            "proposed_far": 1.5,
            "max_height_m": 11.5,
            "proposed_height_m": 10.2,
            "max_coverage_pct": 60,
            "proposed_coverage_pct": 51.6,
        },
    }, headers=auth_headers)
    response = client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # With valid data: data-quality checks should pass, regulatory checks should be in_review
    # (because regulatory limits are unverified)
    assert data["passing"] > 0
    assert data["failing"] == 0


def test_run_compliance_with_exceeding_far(client, auth_headers, test_project):
    pid = test_project["id"]
    client.patch(f"/api/projects/{pid}", json={
        "plot_data": {
            "width": 12.19,
            "length": 18.29,
            "area": 222.9,
            "max_far": 1.75,
            "proposed_far": 2.0,  # exceeds max
        },
    }, headers=auth_headers)
    response = client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["failing"] > 0
    # Find FAR rule
    far_check = next((c for c in data["checks"] if c["rule_code"] == "FAR_DATA"), None)
    assert far_check is not None
    assert far_check["status"] == "failing"


def test_run_compliance_with_inconsistent_area(client, auth_headers, test_project):
    pid = test_project["id"]
    client.patch(f"/api/projects/{pid}", json={
        "plot_data": {
            "width": 10,
            "length": 20,
            "area": 500,  # 10*20=200, 500 is way off
        },
    }, headers=auth_headers)
    response = client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    data = response.json()
    area_check = next((c for c in data["checks"] if c["rule_code"] == "PLOT_AREA_CONSISTENCY"), None)
    assert area_check is not None
    assert area_check["status"] == "failing"


def test_get_compliance_returns_persisted_results(client, auth_headers, test_project):
    pid = test_project["id"]
    # Run first
    client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    # Then get
    response = client.get(f"/api/projects/{pid}/compliance", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["checks"]) > 0


def test_run_compliance_replaces_previous(client, auth_headers, test_project):
    pid = test_project["id"]
    # Run twice
    client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    response1 = client.get(f"/api/projects/{pid}/compliance", headers=auth_headers)
    count1 = len(response1.json()["checks"])
    
    client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    response2 = client.get(f"/api/projects/{pid}/compliance", headers=auth_headers)
    count2 = len(response2.json()["checks"])
    
    # Should not accumulate
    assert count1 == count2


def test_compliance_nonexistent_project(client, auth_headers):
    response = client.post("/api/projects/nonexistent-id/compliance/run", headers=auth_headers)
    assert response.status_code == 404


def test_compliance_no_auth(client, test_project):
    pid = test_project["id"]
    response = client.get(f"/api/projects/{pid}/compliance")
    assert response.status_code == 403


def test_run_compliance_with_malformed_dimensions(client, auth_headers, test_project):
    pid = test_project["id"]
    client.patch(f"/api/projects/{pid}", json={
        "plot_data": {
            "width": "not-a-number",
            "length": -5,
        },
    }, headers=auth_headers)
    response = client.post(f"/api/projects/{pid}/compliance/run", headers=auth_headers)
    data = response.json()
    dim_check = next((c for c in data["checks"] if c["rule_code"] == "PLOT_DIMENSIONS"), None)
    assert dim_check is not None
    assert dim_check["status"] == "failing"
