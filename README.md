# Altiplano RainCast AI — Plataforma MLOps de lluvia en Puno

Clasificación binaria supervisada: **¿lloverá mañana en Puno, Perú?** El sistema ingiere Open-Meteo, reentrena un `Pipeline` de scikit-learn con `GridSearchCV`, publica el artefacto `.joblib` y los pesos matemáticos en Supabase, y responde en Next.js sin reiniciar el proceso de inferencia.

La interfaz de la aplicación está en inglés. Esta documentación está en español para el equipo de TI.

## Credenciales y datos importantes antes de iniciar

El proyecto de Supabase ya existe. La URL base, sin el sufijo `/rest/v1`, es:

```text
https://eqzsjrfwrolhlualnbdn.supabase.co
```

| Dato | Valor |
| --- | --- |
| Ciudad | Puno, Perú |
| Latitud / longitud | `-15.8402`, `-70.0219` |
| Zona horaria | `America/Lima` |
| Umbral de lluvia | `precipitation_sum` del día siguiente `>= 1.0 mm` |
| Bucket de artefactos | `models` (público) |
| Tablas | `weather_features`, `model_registry`, `daily_forecasts` |
| Secreto de webhook anotado | `WEBHOOK_SECRET=mlops_secret_puno_2026` |

Las claves `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están en el archivo local `credenciales y datos importantes pre iniciar.txt`. Ese archivo, el `.env` de la raíz y `frontend/.env.local` están en `.gitignore`. No se suben al remoto.

El `WEBHOOK_SECRET` queda guardado en el `.env` local. Esta arquitectura no llama a Render ni recarga un modelo en RAM: cada request de `/api/predict` lee la fila activa de `model_registry`. Por eso el secreto no es una variable de Vercel ni de GitHub Actions.

### Variables que sí debe configurar el equipo

GitHub → Settings → Secrets and variables → Actions:

| Secret | Uso |
| --- | --- |
| `SUPABASE_URL` | `https://eqzsjrfwrolhlualnbdn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` del archivo local. La usa el workflow de reentrenamiento. |
| `SUPABASE_ANON_KEY` | Opcional en CI. Si falta, el build de Next.js usa una clave ficticia y solo valida la compilación. |

Vercel → Project → Settings → Environment Variables, con **Root Directory = `frontend`**:

| Variable | Dónde se lee |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente anon de `@supabase/supabase-js` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente anon del navegador |
| `SUPABASE_URL` | Rutas servidor `/api/predict` y `/api/status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Mismas rutas. No lleva prefijo `NEXT_PUBLIC_`. |

En esta máquina de desarrollo esas variables ya están escritas en `.env` y `frontend/.env.local`.

## Arranque local

Requisitos: Python 3.11 (el workflow de GitHub lo fija; 3.12 también ejecuta este código), Node.js 20 y las variables anteriores.

En esta máquina las dependencias de Python ya están en `.venv` y el frontend ya tiene `node_modules`. La primera publicación en Supabase es la versión `v1.0.20261020_145359`.

```powershell
.\.venv\Scripts\python.exe -m pip install -r ml_pipeline/requirements.txt
.\.venv\Scripts\python.exe -m pytest ml_pipeline/tests/ -v
.\.venv\Scripts\python.exe -m ml_pipeline.fetch_data
.\.venv\Scripts\python.exe -m ml_pipeline.train_and_evaluate
cd frontend
npm install
npm run dev
```

La aplicación queda en `http://localhost:3000`. Los cuatro apartados en inglés son Tomorrow Forecast, Live Inference, Model Registry y Feature Store.

## Qué hace cada pipeline

| Workflow | Disparador | Efecto |
| --- | --- | --- |
| `.github/workflows/ci-cd-pipeline.yml` | `push` y `pull_request` hacia `main` | `pytest` del pipeline y `npm run build` de Next.js |
| `.github/workflows/mlops-retrain.yml` | Cron `0 6 * * *` (06:00 UTC = 01:00 en Lima) y botón **Run workflow** | pytest, ingesta Open-Meteo, reentrenamiento, subida del `.joblib` y cambio del modelo activo |

El cron está expresado en UTC, como exige GitHub Actions. Para la exposición se usa **workflow_dispatch**, no hace falta esperar a la 01:00 de Lima.

## Contrato de inferencia

El modelo publicado es `StandardScaler` + `LogisticRegression`. Next.js no carga el `.joblib`. Repite esta fórmula con los arreglos de `model_weights`:

```text
z = w · ((x - mean) / scale) + b
P(lluvia) = 1 / (1 + exp(-z))
```

`ml_pipeline/tests/test_mlops.py` exige que esa probabilidad coincida con `predict_proba` de scikit-learn con tolerancia absoluta `1e-6`. El job de entrenamiento aborta la publicación si la paridad falla.

## Documentación de TI

- [Informe técnico](docs/INFORME_TECNICO_TI.md)
- [Arquitectura y pipeline](docs/ARQUITECTURA_Y_PIPELINE.md)
- [Guion de exposición y protocolo de prueba](docs/GUIA_EXPOSICION_Y_PRUEBAS.md)

## Despliegue en Vercel

1. Importar el repositorio de GitHub.
2. Framework preset: Next.js.
3. Root Directory: `frontend`.
4. Cargar las cuatro variables de entorno de la tabla anterior.
5. Deploy. Las rutas `/api/predict` y `/api/status` quedan en el runtime Node de Vercel.

Un despliegue nuevo del frontend no interrumpe el modelo: el modelo vive en Supabase, no dentro del bundle.
