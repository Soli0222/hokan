{{/*
Expand the name of the chart.
*/}}
{{- define "hokan.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "hokan.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "hokan.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "hokan.labels" -}}
helm.sh/chart: {{ include "hokan.chart" . }}
{{ include "hokan.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "hokan.selectorLabels" -}}
app.kubernetes.io/name: {{ include "hokan.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "hokan.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "hokan.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL host.
*/}}
{{- define "hokan.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "hokan.fullname" .) }}
{{- else }}
{{- required "externalPostgres.host is required when postgresql.enabled=false" .Values.externalPostgres.host }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL port.
*/}}
{{- define "hokan.postgresql.port" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.service.port }}
{{- else }}
{{- .Values.externalPostgres.port }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL database.
*/}}
{{- define "hokan.postgresql.database" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.auth.database }}
{{- else }}
{{- required "externalPostgres.database is required when postgresql.enabled=false" .Values.externalPostgres.database }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL user.
*/}}
{{- define "hokan.postgresql.user" -}}
{{- if .Values.postgresql.enabled }}
{{- .Values.postgresql.auth.user }}
{{- else }}
{{- required "externalPostgres.user is required when postgresql.enabled=false" .Values.externalPostgres.user }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL password secret name.
*/}}
{{- define "hokan.postgresql.secretName" -}}
{{- if .Values.postgresql.enabled }}
{{- default (printf "%s-postgresql" (include "hokan.fullname" .)) .Values.postgresql.auth.existingSecret }}
{{- else }}
{{- required "externalPostgres.existingSecret is required when postgresql.enabled=false" .Values.externalPostgres.existingSecret }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL password secret key.
*/}}
{{- define "hokan.postgresql.secretKey" -}}
{{- if .Values.postgresql.enabled }}
{{- default "POSTGRES_PASSWORD" .Values.postgresql.auth.existingSecretKey }}
{{- else }}
{{- default "password" .Values.externalPostgres.existingSecretKey }}
{{- end }}
{{- end }}

{{/*
Resolve the PostgreSQL PVC name.
*/}}
{{- define "hokan.postgresql.pvcName" -}}
{{- if .Values.postgresql.persistence.existingClaim }}
{{- .Values.postgresql.persistence.existingClaim }}
{{- else }}
{{- printf "%s-postgresql" (include "hokan.fullname" .) }}
{{- end }}
{{- end }}
