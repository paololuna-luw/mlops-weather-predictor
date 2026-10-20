# Guía de estudio para la exposición del 21 de octubre de 2026

Sirve para defender el código que ya está en GitHub y los datos que ya están en Supabase. El informe técnico de 8 puntos lo prepara otra parte del equipo. Aquí solo está la explicación técnica de 12 puntos, de 12 a 15 minutos.

Repositorio: https://github.com/paololuna-luw/mlops-weather-predictor

La mañana de la presentación se abre la aplicación y se lee la fila **Active**. Esos números son los que se dicen. Una corrida nueva, cada 3 horas, cambia la fila activa. La primera publicación local queda en el historial como ejemplo: versión `v1.0.20261020_145359`, accuracy 0.788, F1 0.789, ROC-AUC 0.892, `C=0.01`, `class_weight` nulo, solver `lbfgs`, matriz `[[57, 15], [16, 58]]`, 730 días etiquetados.

## Qué abrir y qué no abrir

Abrir en este orden:

1. La aplicación en Vercel, en inglés.
2. Supabase, solo las tres tablas y el bucket `models`.
3. GitHub Actions, los dos workflows.
4. Un archivo de código, el que pregunten. No recorrer el repositorio entero.

## Reparto de 14 minutos

| Minuto | Quién habla | Dónde se mira | Puntos |
| --- | --- | --- | --- |
| 0:00–2:30 | Integrante 1 | App, pestaña Tomorrow Forecast, en inglés | Funcionamiento, 2 pts |
| 2:30–4:30 | Integrante 1 | App, pestaña Feature Store, y tabla `weather_features` | Entrenamiento, parte dataset |
| 4:30–8:30 | Integrante 2 | App, pestaña Model Registry, y tabla `model_registry` | Entrenamiento, 4 pts |
| 8:30–10:30 | Integrante 3 | Vercel y `frontend/src/app/api/predict/route.ts` | Despliegue, 2 pts |
| 10:30–14:00 | Integrante 4 | GitHub Actions y, al volver, Refresh en la app | Pipelines, 4 pts |

## 1. Funcionamiento de la aplicación en inglés (2 pts)

Toda la pantalla está en inglés. El archivo de la página es `frontend/src/app/page.tsx`. El texto visible sale de `frontend/src/components/`.

Qué decir, en inglés, mientras se señala la pantalla:

> This is Altiplano RainCast AI, a supervised model for Puno, Peru. The question is: will it rain tomorrow? The banner says Production Status: Zero-Downtime Active. This card is tomorrow's automated forecast. If the model says yes, the business action is to hold irrigation and alert urban drainage. If it says no, agricultural and transport operations stay normal.

Dónde está cada frase:

| Lo que se ve | Archivo |
| --- | --- |
| Título **Altiplano RainCast AI — Supervised MLOps Platform** | `frontend/src/components/Dashboard.tsx` |
| **Production Status: Zero-Downtime Active** y botón **Refresh Live MLOps State** | el mismo archivo |
| **RAIN EXPECTED TOMORROW** o **CLEAR / DRY CONDITIONS EXPECTED** | `frontend/src/components/ForecastHero.tsx` |
| Acción de negocio: irrigation hold o normal operations | el mismo archivo, debajo de la barra de probabilidad |
| Las 7 variables de hoy que originaron el pronóstico | columna derecha de esa misma tarjeta |

El pronóstico de esa tarjeta no se calcula al abrir la página. Ya está guardado en Supabase, tabla `daily_forecasts`. La página lo pide con `GET /api/status`, archivo `frontend/src/app/api/status/route.ts`.

Para el simulador, pestaña **Live Inference**:

1. Pulsar **Heavy Storm Front**. Debe tender a lluvia.
2. Pulsar **Typical Dry Winter Day**. Debe tender a seco.
3. Pulsar **Run Live Inference**.

Eso hace `POST /api/predict`. En la respuesta se señala: probabilidad, **Yes** o **No**, `model_version`, tiempo en milisegundos e impacto de cada variable. Los botones están en `frontend/src/components/InferenceLab.tsx`.

## 2. Dataset, entrenamiento, características e hiperparámetros (4 pts)

### Dataset: de dónde sale y dónde se ve

Ciudad y reglas, todas juntas en `ml_pipeline/config.py`, líneas 21 a 49:

- Puno, latitud `-15.8402`, longitud `-70.0219`, zona `America/Lima`.
- 730 días de historia.
- Lluvia si la precipitación del día siguiente es de al menos `1.0` mm. La constante es `RAIN_THRESHOLD_MM`.
- Las 7 features, en este orden: temperatura máxima, temperatura mínima, temperatura aparente máxima, viento máximo, radiación de onda corta, evapotranspiración FAO y precipitación.

Esas 7 columnas también están en `frontend/src/types/mlops.ts`, arreglo `FEATURE_NAMES`. El orden es el mismo en Python y en la web. Si se cambia uno y no el otro, la predicción deja de coincidir.

En la app: pestaña **Feature Store**. Muestra los últimos 10 días. La última fila, la de hoy, dice **Pending** en Rain tomorrow porque el día de mañana todavía no ocurrió.

En Supabase, Table Editor, tabla `weather_features`:

- Una fila por fecha. La fecha es la clave.
- Las mismas 7 columnas.
- `target_rain_tomorrow`: `1` llueve mañana, `0` no llueve, vacío solo en el día de hoy.
- El dataset completo vive aquí. La pantalla enseña 10 filas para que se pueda leer. El total de días usados para entrenar está en `model_registry.dataset_rows` y en la tarjeta **Training Dataset Size (Days)**.

Cómo se arma esa tabla: `ml_pipeline/fetch_data.py`.

- Historia: `https://archive-api.open-meteo.com/v1/archive`, función `fetch_archive_frame`, línea 93.
- Últimos 7 días y hoy: `https://api.open-meteo.com/v1/forecast`, función `fetch_recent_frame`, línea 122.
- Si el mismo día viene en las dos fuentes, gana la más reciente. Está en `assemble_feature_frame`, línea 149: `drop_duplicates(..., keep="last")`.
- Huecos: interpolación y luego `ffill` y `bfill`, líneas 153 y 154. Solo en las features.
- La etiqueta es la precipitación de mañana: `shift(-1) >= 1.0`, líneas 159 a 162. La última fila queda vacía.
- Se sube a Supabase por lotes de 500, función `upsert_feature_records`, línea 184. Si el día ya existe, se actualiza. No se borra el resto de los días.

Frase para decir: el modelo no descarga Open-Meteo. Entrena con lo que ya está en `weather_features`.

### Entrenamiento: qué archivo abrir si preguntan el código

Archivo único: `ml_pipeline/train_and_evaluate.py`.

| Pregunta | Dónde responder |
| --- | --- |
| ¿Qué algoritmo? | `build_pipeline`, líneas 48 a 57: `StandardScaler` y después `LogisticRegression(max_iter=1000, random_state=42)`. Escalar va dentro del pipeline para no usar el conjunto de prueba al calcular la media. |
| ¿Cómo se separan los datos? | Líneas 269 a 275: 80 % entrenamiento, 20 % prueba, `stratify` para conservar la proporción de días de lluvia, `random_state=42`. |
| ¿Qué día no entra al entrenamiento? | `split_supervised_and_today`, línea 142. La última fila es hoy y no tiene etiqueta. Con ella solo se predice mañana. |
| ¿Qué se optimiza? | `fit_grid_search`, líneas 60 a 68: `GridSearchCV`, 5 folds, `scoring="f1"`, `n_jobs=-1`. |
| ¿Qué hiperparámetros se probaron? | `ml_pipeline/config.py`, líneas 64 a 68. `C`: 0.01, 0.1, 0.5, 1, 5 y 10. `class_weight`: ninguno o `balanced`. `solver`: `lbfgs` o `liblinear`. Son 24 combinaciones por 5 pliegues. |
| ¿Por qué F1 y no accuracy? | Porque en el altiplano hay rachas secas. Accuracy puede verse alta solo por decir que no llueve. F1 mira la clase lluvia. Accuracy y ROC-AUC se reportan, pero la grilla elige por F1. |
| ¿Dónde se calculan las métricas? | `evaluate_on_holdout`, líneas 73 a 86. Accuracy, F1, ROC-AUC y matriz `[[TN, FP], [FN, TP]]` sobre el 20 % que no vio la grilla. |

### Dónde mostrar las métricas sin abrir código

Primero en la app, pestaña **Model Registry**:

- Cuatro tarjetas: **Accuracy**, **F1-Score (Optimization Target)**, **ROC-AUC**, **Training Dataset Size (Days)**.
- Matriz 2x2: True negatives, False positives, False negatives, True positives.
- Recuadro **Optimized hyperparameters**: el JSON con `classifier__C`, `classifier__class_weight`, `classifier__solver` y `best_cv_f1`.
- Barras de coeficientes. Un coeficiente positivo, después de estandarizar, empuja hacia lluvia.

Si piden la base de datos, Supabase, tabla `model_registry`, fila con `is_active = true`. Columnas que se nombran:

| Columna | Qué decir |
| --- | --- |
| `version` | Identificador `v1.0.fecha_hora`, hora de Lima |
| `algorithm` | Texto fijo `LogisticRegression (GridSearchCV)` |
| `best_hyperparameters` | El ganador de la grilla y el F1 de la validación cruzada |
| `accuracy`, `f1_score`, `roc_auc` | Métricas del 20 % de prueba |
| `confusion_matrix` | `[[TN, FP], [FN, TP]]` |
| `dataset_rows` | Días con etiqueta. Hoy no cuenta. |
| `model_weights` | Media, escala, 7 coeficientes, intercepto y umbral 0.5 |
| `storage_path` | URL del `.joblib` de esa versión |
| `is_active` | `true` solo en el vigente |

Las filas con `is_active = false` son el historial. No se borran. En la app están al final de Model Registry, tabla **Model lineage and continuous training history**, estados **Active** y **Archived**. El código que archiva sin borrar es `publish_model_row`, líneas 222 a 234 de `train_and_evaluate.py`: inserta la nueva como activa y después apaga las demás.

En Storage, bucket `models`:

- `model_v1.0.fecha_hora.joblib` es el archivo de esa versión. No se reescribe.
- `model_latest.joblib` sí se reemplaza. Siempre es el vigente.
- El botón **Download .joblib Model Artifact** abre el archivo de la versión, no el `latest`.

`model_weights` es lo que usa la web. El `.joblib` es la copia para auditoría. Vercel no instala scikit-learn.

La fórmula, para decirla una vez:

```text
z = w · ((x - media) / escala) + intercepto
P(lluvia) = 1 / (1 + e^(-z))
```

Está escrita en `ml_pipeline/inference_math.py`, líneas 1 a 15, y otra vez en `frontend/src/lib/modelEngine.ts`, líneas 3 a 16. El impacto que muestra el simulador es `coeficiente × valor ya estandarizado`. Esos siete impactos más el intercepto suman `z`.

La prueba de que las dos fórmulas coinciden es `ml_pipeline/tests/test_mlops.py`, función `test_serialization_parity`, línea 149. Exige diferencia menor a `0.000001`. El entrenamiento también lo comprueba antes de publicar: `assert_serialization_parity`, línea 290. Si no coincide, no entra una fila nueva a `model_registry`.

## 3. Despliegue (2 pts)

Decir esto mientras se enseña el enlace de Vercel:

- El sitio es Next.js. Vercel construye solo la carpeta `frontend`. Si la raíz del proyecto en Vercel no es `frontend`, el build no encuentra `package.json`.
- Cada visita a `/api/predict` lee en ese momento la fila activa. No hay un modelo cargado en la memoria del servidor. Por eso un reentrenamiento no obliga a volver a desplegar la web.
- El archivo de esa lectura es `frontend/src/lib/registry.ts`, función `loadActiveModel`, línea 156. Ordena por fecha y se queda con la activa más nueva.
- La matemática ocurre en `frontend/src/lib/modelEngine.ts`, función `predictFromWeights`, línea 41. La ruta que la llama es `frontend/src/app/api/predict/route.ts`, función `POST`, línea 29.
- La clave `service_role` está solo en el servidor de Vercel, variable `SUPABASE_SERVICE_ROLE_KEY`. No va en el navegador. La URL pública y la clave anónima son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- El cliente Supabase del servidor está en `frontend/src/lib/supabase.ts`, función `getServerSupabase`, línea 22.

Prueba de producción que se puede hacer en voz alta: en Live Inference, el campo **Model version** de la respuesta tiene que ser igual a `model_registry.version` de la fila activa.

## 4. Pipelines de mantenimiento e integración continua (4 pts)

Hay dos workflows. Están separados a propósito.

### Integración continua: no toca la base

Archivo: `.github/workflows/ci-cd-pipeline.yml`.

Nombre en GitHub: **DevOps CI - Automated Tests & Build Validation**.

Se dispara solo con push o pull request a `main`. Dos trabajos en paralelo:

- `pytest-ml-validation`: instala Python 3.11 y corre `pytest ml_pipeline/tests/ -v`.
- `nextjs-build-validation`: entra a `frontend`, hace `npm install` y `npm run build`.

Esas pruebas no llaman a Open-Meteo ni a Supabase. Usan datos sintéticos. Las tres pruebas, en `ml_pipeline/tests/test_mlops.py`, son:

- `test_feature_columns_definition`, línea 61: las 7 columnas, Puno, el umbral de 1 mm y que la etiqueta mire el día siguiente.
- `test_grid_search_training_and_metrics`, línea 122: la grilla entrena y las métricas quedan entre 0 y 1.
- `test_serialization_parity`, línea 149: la fórmula de la web coincide con scikit-learn.

### Mantenimiento del modelo: sí escribe en Supabase

Archivo: `.github/workflows/mlops-retrain.yml`.

Nombre en GitHub: **MLOps Continuous Training & Deployment Pipeline**.

Es automático. El cron está en las líneas 7 y 8: `0 */3 * * *`. En Lima corre a las 19:00, 22:00, 01:00, 04:00, 07:00, 10:00, 13:00 y 16:00. También se puede lanzar con **Run workflow**.

Orden de los pasos, líneas 42 a 49. Hay que decirlo en este orden:

1. `pytest`. Si falla, no se publica nada y el modelo activo sigue igual.
2. `python -m ml_pipeline.fetch_data`. Actualiza `weather_features`.
3. `python -m ml_pipeline.train_and_evaluate`. Entrena, sube el `.joblib`, inserta la fila nueva y archiva las anteriores. También inserta un pronóstico en `daily_forecasts`. Los pronósticos viejos se quedan.

Las claves de ese workflow están en GitHub Secrets: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Se nombran en las líneas 24 y 25 del mismo archivo. No se abren los valores delante del jurado.

### Cómo demostrar que no se cae la aplicación

1. Anotar la versión que dice el banner.
2. En GitHub, Actions, abrir **MLOps Continuous Training & Deployment Pipeline** y pulsar **Run workflow**.
3. Mostrar el paso verde de pytest, luego la ingesta y luego el entrenamiento. El log imprime la versión nueva, las tres métricas y la URL del `.joblib`.
4. Volver a la pestaña de la aplicación. No recargar el navegador con F5. Pulsar **Refresh Live MLOps State**.
5. La versión del banner cambia. En Model Registry la nueva está **Active** y la anterior **Archived**. En Supabase se ven las dos filas.

Frase de cierre: la página no se reinició. La siguiente consulta leyó la fila nueva de `model_registry`.

Si el jurado pregunta cuánto tarda GitHub en arrancar el cron: a veces se retrasa unos minutos. El botón **Run workflow** ejecuta exactamente el mismo trabajo.

## Si preguntan algo concreto

| Pregunta | Respuesta corta | Dónde señalarlo |
| --- | --- | --- |
| ¿Se reescriben los modelos viejos? | No. Se inserta una fila y las viejas pasan a archivadas. | `publish_model_row`, líneas 222 a 234. Tabla `model_registry`. |
| ¿Qué archivo sí se reemplaza? | Solo `model_latest.joblib`. Cada versión tiene su propio archivo. | `upload_joblib`, líneas 202 y 203. Bucket `models`. |
| ¿El dataset se borra cada 3 horas? | No. Se actualiza por fecha. Los días anteriores siguen. | `upsert_feature_records` en `fetch_data.py`. |
| ¿Por qué la última fila no tiene target? | Porque su mañana aún no existe. | `assemble_feature_frame`, líneas 159 a 162. En la app dice Pending. |
| ¿La web usa el joblib? | No. Usa `model_weights`. | `modelEngine.ts` y la columna `model_weights`. |
| ¿Qué pasa si la fórmula no coincide? | No se publica. | Línea 290 de `train_and_evaluate.py` y el test de la línea 149. |
| ¿Por qué no se cae el sitio al reentrenar? | Cada request lee la fila activa. No hay modelo en memoria. | `loadActiveModel` y el botón Refresh. |
| ¿Dónde está el pronóstico de negocio? | Tabla `daily_forecasts`, última fila por `created_at`. | Pestaña Tomorrow Forecast. |
