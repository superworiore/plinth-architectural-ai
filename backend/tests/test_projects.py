"""Project CRUD tests."""


def test_create_project(client, auth_headers):
    response = client.post("/api/projects/", json={
        "name": "My Project",
        "code": "PRJ-001",
        "typology": "residential",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Project"
    assert data["code"] == "PRJ-001"
    assert data["status"] == "draft"
    assert data["progress"] == 0.0


def test_list_projects(client, auth_headers, test_project):
    response = client.get("/api/projects/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert len(data["projects"]) >= 1


def test_get_project(client, auth_headers, test_project):
    pid = test_project["id"]
    response = client.get(f"/api/projects/{pid}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == pid
    assert data["name"] == "Test Project"


def test_update_project_metadata(client, auth_headers, test_project):
    pid = test_project["id"]
    response = client.patch(f"/api/projects/{pid}", json={
        "name": "Updated Name",
        "location": "New Location",
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["location"] == "New Location"
    # Original fields preserved
    assert data["code"] == "TST-001"
    assert data["budget"] == 1000000.0


def test_update_project_plot_data(client, auth_headers, test_project):
    pid = test_project["id"]
    plot_data = {
        "width": 12.19,
        "length": 18.29,
        "area": 223.0,
        "setbacks": {"front": 3.0, "rear": 1.5, "side1": 1.5, "side2": 1.5},
    }
    response = client.patch(f"/api/projects/{pid}", json={
        "plot_data": plot_data,
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["plot_data"] is not None
    assert data["plot_data"]["width"] == 12.19
    assert data["plot_data"]["length"] == 18.29
    # Original fields preserved
    assert data["name"] == "Test Project"
    assert data["budget"] == 1000000.0


def test_partial_update_preserves_fields(client, auth_headers, test_project):
    pid = test_project["id"]
    # First set plot_data
    client.patch(f"/api/projects/{pid}", json={
        "plot_data": {"width": 10, "length": 20},
    }, headers=auth_headers)
    # Then update only name
    response = client.patch(f"/api/projects/{pid}", json={
        "name": "New Name",
    }, headers=auth_headers)
    data = response.json()
    assert data["name"] == "New Name"
    assert data["plot_data"] is not None
    assert data["plot_data"]["width"] == 10


def test_get_nonexistent_project(client, auth_headers):
    response = client.get("/api/projects/nonexistent-id", headers=auth_headers)
    assert response.status_code == 404


def test_create_project_invalid_data(client, auth_headers):
    response = client.post("/api/projects/", json={
        "name": "",  # empty name should fail
        "code": "X",
    }, headers=auth_headers)
    assert response.status_code == 422


def test_delete_project(client, auth_headers, test_project):
    pid = test_project["id"]
    response = client.delete(f"/api/projects/{pid}", headers=auth_headers)
    assert response.status_code == 204
    # Verify deleted
    response = client.get(f"/api/projects/{pid}", headers=auth_headers)
    assert response.status_code == 404
