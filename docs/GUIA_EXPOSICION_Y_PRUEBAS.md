# Guion de exposición y protocolo de pruebas

Duración objetivo: 12 a 15 minutos. La aplicación se muestra en inglés. La defensa del modelo, del despliegue y del pipeline se puede decir en español. Hay cuatro bloques con el peso de la rúbrica: funcionamiento en inglés (2), dataset y modelo (4), despliegue (2) y demostración en vivo del pipeline (4).

Reparto sugerido:

| Integrante | Minutos | Bloque |
| --- | --- | --- |
| 1 | 0:00–3:30 | Problema, ciudad y dataset |
| 2 | 3:30–7:30 | GridSearchCV, métricas y paridad |
| 3 | 7:30–10:30 | Aplicación en inglés y despliegue Vercel/Supabase |
| 4 | 10:30–14:30 | GitHub Actions en vivo y cierre |

La primera publicación local, del 20 de octubre de 2026, dejó el modelo `v1.0.20261020_145359` (F1 de hold-out 0.789, ROC-AUC 0.892, `C=0.01`, solver `lbfgs`). Sirve como línea de base: al pulsar Run workflow la versión del banner tiene que cambiar.

Antes de entrar al salón, comprobar:

- GitHub Secrets `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` cargados.
- Una ejecución previa del workflow ya dejó un modelo activo, para que la pantalla no esté vacía al empezar.
- La URL de Vercel abre el dashboard. Si Vercel todavía no está publicado, `npm run dev` dentro de `frontend` sirve la misma interfaz en `http://localhost:3000`.
- El repositorio en GitHub muestra la pestaña Actions con el workflow `MLOps Continuous Training & Deployment Pipeline`.

## Minuto 0:00 a 1:00 — Apertura

Decir el caso en una frase: clasificación supervisada de si mañana llueve en Puno, con reentrenamiento diario y sin bajar la aplicación. Mostrar el título exacto de la pantalla:

**Altiplano RainCast AI — Supervised MLOps Platform**

Señalar el banner **Production Status: Zero-Downtime Active**, la versión `v1.0.…` y la fecha de entrenamiento. No recargar el navegador todavía.

## Minuto 1:00 a 3:30 — Defensa del dataset

Integrante 1, en español:

- Ciudad: Puno, latitud `-15.8402`, longitud `-70.0219`, zona `America/Lima`.
- Siete features del día `t`, todas diarias y sacadas de Open-Meteo: temperaturas máxima, mínima y aparente máxima, viento máximo a 10 m, radiación de onda corta, evapotranspiración FAO ET0 y precipitación.
- Etiqueta del día `t+1`: lluvia si la precipitación del día siguiente es de al menos 1.0 mm. Es una decisión operativa, no una llovizna de trazas.
- Ventana: 730 días del archive API más los últimos 7 días y el día de hoy del forecast API. La fila de hoy queda con `target_rain_tomorrow` nulo.
- El archivo y el forecast se unen por fecha. Si el mismo día está en las dos fuentes, se conserva el forecast.
- Huecos: interpolación temporal y después `ffill`/`bfill` solo en features. La etiqueta no se rellena.
- Mostrar la vista **Feature Store**. Los últimos 10 días salen de `weather_features`. La última fila debe decir **Pending** en “Rain tomorrow”.

Frase de cierre del bloque: el feature store es la tabla `weather_features`; el entrenamiento no lee Open-Meteo por su cuenta.

## Minuto 3:30 a 7:30 — GridSearchCV y métricas

Integrante 2, en español, con la vista **Model Registry** proyectada:

- Algoritmo: regresión logística dentro de un `Pipeline` con `StandardScaler`. Escalar dentro del pipeline evita ajustar la media con el hold-out.
- Split: `test_size=0.2`, `stratify=y`, `random_state=42`.
- Búsqueda: `GridSearchCV`, 5 folds, `scoring='f1'`, `n_jobs=-1`.
- Espacio: `C` de 0.01 a 10, `class_weight` nulo o `balanced`, solver `lbfgs` o `liblinear`.
- El F1 del hold-out es la tarjeta **F1-Score (Optimization Target)**. Accuracy y ROC-AUC se reportan y no deciden la grilla. La matriz es `[[TN, FP], [FN, TP]]`: true positives, false positives, true negatives y false negatives están rotulados en la pantalla.
- `dataset_rows` es el número de días etiquetados. La fila de hoy no entra al ajuste porque no tiene etiqueta.
- Abrir el JSON de **Optimized Hyperparameters** y leer `classifier__C`, `classifier__class_weight`, `classifier__solver` y `best_cv_f1`.
- Explicar los coeficientes: un valor positivo empuja el logit hacia lluvia después de estandarizar. El impacto del simulador es `w_i` por la feature ya escalada.
- Paridad: pytest `test_serialization_parity` y una aserción dentro del propio entrenamiento comparan `predict_proba` con la sigmoide de `model_weights` a `1e-6`. Si no coinciden, el modelo no se publica. Next.js ejecuta esa misma fórmula; por eso no hace falta instalar scikit-learn en Vercel.

## Minuto 7:30 a 10:30 — Aplicación en inglés y despliegue

Este bloque se dice en inglés. Es la evidencia de funcionamiento de la aplicación.

Suggested script:

> This is Altiplano RainCast AI, a supervised MLOps platform for Puno, Peru. The question is: will it rain tomorrow?
>
> The hero card is the automated business forecast. It reads the latest row from daily forecasts. If the active model says yes, the screen states RAIN EXPECTED TOMORROW and the business action: activate the agricultural irrigation hold and the urban drainage alert. If it says no, the screen states CLEAR / DRY CONDITIONS EXPECTED and normal agricultural and transport operations. The probability bar is the stored rain probability, and the seven figures on the right are today's inputs.
>
> I am not reloading the browser. Refresh Live MLOps State calls `/api/status` and repaints the production version, the training time, and the registry.
>
> Now the live inference simulator. I choose Heavy Storm Front, which raises precipitation and wind and lowers radiation. Run Live Inference posts the seven values to `/api/predict`. The serverless route loads the active model from Supabase, applies the standard scaler and the logistic function, and returns the probability, the binary label, the model version, the inference time in milliseconds, and the impact of each feature.
>
> Typical Dry Winter Day is the opposite scenario: cold nights, high radiation, no precipitation.
>
> The registry shows accuracy, F1, ROC-AUC, and the training dataset size in days. This link, Download .joblib Model Artifact, opens the versioned file in the public Supabase Storage bucket named models. The history table marks one version Active and the older versions Archived.

Integrante 3, al volver al español, conecta la pantalla con el despliegue:

- Frontend en Vercel, directorio raíz `frontend`, cuatro variables de entorno. La service role solo existe en el servidor.
- Supabase guarda features, registry, pronósticos y el bucket `models`.
- El `.joblib` es el artefacto auditable. La predicción en línea usa `model_weights`.
- Un deploy de Vercel y un reentrenamiento pueden ocurrir a la vez porque no comparten memoria.

Si hay que mostrar la URL, usar la de Vercel. Si el despliegue aún no está, decirlo y usar localhost: el código de las rutas es el mismo que Vercel ejecuta.

## Minuto 10:30 a 14:30 — Demostración en vivo del pipeline

Integrante 4 ejecuta estos pasos en el proyector, sin saltarse el orden:

1. Anotar en voz alta la versión que el banner muestra ahora. Ejemplo: `v1.0.20261020_183045`.
2. En GitHub, abrir **Actions**.
3. Elegir **MLOps Continuous Training & Deployment Pipeline**.
4. Pulsar **Run workflow**, rama `main`, y confirmar.
5. Abrir el run. Mostrar que el job se llama `Ingest, test, retrain, and hot-swap`.
6. Esperar el paso **Run pipeline quality tests** (`pytest ml_pipeline/tests/ -v`). Si este paso falla, el job se detiene y el modelo activo no cambia. Decirlo.
7. Mostrar **Ingest Open-Meteo observations into the feature store**.
8. Mostrar **Retrain, evaluate, and publish with zero downtime**. En el log aparecen accuracy, F1, ROC-AUC, la nueva versión y la URL del artefacto.
9. Volver a la aplicación. No pulsar recargar del navegador. Pulsar **Refresh Live MLOps State**.
10. La versión del banner debe ser la nueva. En **Model Registry**, la nueva fila está **Active** y la anterior **Archived**. En **Tomorrow Forecast**, la fecha de guardado y la probabilidad corresponden a la corrida que acaba de terminar. En **Feature Store**, la fila de hoy sigue en **Pending**.

Frase de cierre:

> La pestaña nunca se cayó. Next.js no tenía el modelo cargado en memoria: cada request lee la fila activa. Por eso el cambio de versión es un hot-swap en Supabase y el servicio no se reinicia.

Si el tiempo alcanza, lanzar el simulador otra vez y mostrar que `model_version` en la respuesta ya es la versión nueva.

## Qué decir si algo falla durante la demo

| Síntoma | Causa probable | Respuesta honesta y siguiente paso |
| --- | --- | --- |
| El workflow falla en el primer segundo de Python | Falta `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_URL` en Secrets | Abrir Settings → Secrets y mostrar que los nombres existen, sin revelar el valor. Relanzar. |
| pytest falla | El contrato de features o la paridad se rompió en el commit | No se publica un modelo. Mostrar el nombre de la prueba roja. El modelo anterior sigue activo. |
| Open-Meteo devuelve error | Ventana del archive fuera de rango o red | El módulo retrocede el fin del archivo hasta 7 días. Si aun así falla, el registry no se toca. |
| Refresh muestra la versión vieja | El run todavía no terminó el insert | Volver al log, esperar el `Model published`, pulsar otra vez el botón. |
| `/api/predict` responde 404 | No hay `model_weights` activos | La UI ya lo dice. Ejecutar el workflow o `python -m ml_pipeline.train_and_evaluate` en local. |
| La pantalla está en español | No debería ocurrir | Toda copia visible está en `frontend/src`. Corregir ahí, no en los markdown. |

## Protocolo de prueba reproducible, fuera de la exposición

Desde la raíz del repositorio, con el `.env` ya creado:

```powershell
python -m pip install -r ml_pipeline/requirements.txt
python -m pytest ml_pipeline/tests/ -v
python -m ml_pipeline.fetch_data
python -m ml_pipeline.train_and_evaluate
cd frontend
npm install
npm run build
npm run dev
```

Comprobaciones mínimas:

1. pytest: `test_feature_columns_definition`, `test_grid_search_training_and_metrics`, `test_serialization_parity` en verde.
2. `fetch_data` imprime el número de filas upsert en `weather_features`.
3. `train_and_evaluate` imprime una versión `v1.0.*`, tres métricas entre 0 y 1, y una URL pública del bucket `models`.
4. `GET http://localhost:3000/api/status` devuelve `production_status` igual a `Zero-Downtime Active`.
5. `POST http://localhost:3000/api/predict` con las siete features devuelve `will_rain`, `rain_probability`, `model_version` e `impacts` de longitud 7.
6. El build de Next.js termina sin errores de TypeScript.

El cron `0 6 * * *` queda como mantenimiento diario. La exposición no depende de él: depende de **Run workflow**.
