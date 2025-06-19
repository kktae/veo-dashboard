#!/bin/bash

REGISTRY_PROJECT_ID=veo-poc-462605 # $(gcloud config get project)
REGISTRY_REGION=us-central1
IMAGE_NAME=veo-dashboard
IMAGE_TAG=latest
ARTIFACT_REGISTRY_URL=$REGISTRY_REGION-docker.pkg.dev/$REGISTRY_PROJECT_ID/$IMAGE_NAME

docker tag veo-dashboard:latest $ARTIFACT_REGISTRY_URL/$IMAGE_NAME:$IMAGE_TAG

# need permission to push to artifact registry (artifactregistry.repositories.uploadArtifacts)
# gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin https://us-central1-docker.pkg.dev
docker push $ARTIFACT_REGISTRY_URL/$IMAGE_NAME:$IMAGE_TAG