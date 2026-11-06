# Mental Health Disorder Risk Prediction Using Behavioral and Linguistic Features

Department of Computer Application, ATMECE, Mysore, 2025–26

This is a screening flag, not a clinical diagnosis. The result is an early risk indicator. It does not replace a counsellor, a psychiatrist, or any clinical assessment.

## 1. What was built

The system estimates stress risk from a short journal, optional routine metadata, and an optional voice note. Linguistic features come from the writing. Behavioral features come from the time of the post and the response it received. Voice features are extracted from a recording, then shown to the user. The current score does not use voice, because no labeled English audio set is in the training data yet.

The app is at `http://127.0.0.1:5173`. The API is at `http://127.0.0.1:8000`.

Risk bands shown on the result screen:

| Probability | Level |
|---|---|
| Under 0.40 | Low |
| 0.40 to 0.70 | Moderate |
| Above 0.70 | High |

## 2. Data

Dreaddit, the public Reddit stress corpus, is the labeled dataset. The official train, validation, and test files were kept separate. Empty text was not present, so all 3,553 labeled segments remain.

| Split | No stress (0) | Stress (1) |
|---|---:|---:|
| Train | 1,092 | 1,178 |
| Validation | 258 | 310 |
| Test | 346 | 369 |

Linguistic features, fit on the training split only: VADER compound sentiment, first-person pronoun share, type–token ratio, word count, and 3,000 TF-IDF terms.

Behavioral features: hour of `social_timestamp`, karma, upvote ratio, and comment count.

Voice features, checked on a generated tone: speaking rate, pause ratio, pause count, pitch mean, pitch range, loudness, jitter, and 13 MFCCs.

## 3. Experiment 1 — both feature types

Three classifiers were trained on the training split and scored on the test split: logistic regression, linear SVM, and random forest. Each was trained on text only, behavior only, and both. The saved model for each feature set is the one with the highest validation F1.

The numbers below are copied from `reports/experiment1.csv`.

| Features | Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---:|---:|---:|---:|---:|
| Text | Logistic regression | 0.6755 | 0.6770 | 0.7100 | 0.6931 | 0.7247 |
| Text | Linear SVM | 0.6462 | 0.6457 | 0.6965 | 0.6701 | 0.6959 |
| Text | Random forest | 0.7524 | 0.7275 | 0.8320 | 0.7762 | 0.8322 |
| Behavior | Logistic regression | 0.5818 | 0.5729 | 0.7453 | 0.6478 | 0.5908 |
| Behavior | Linear SVM | 0.5734 | 0.5552 | 0.8726 | 0.6786 | 0.5998 |
| Behavior | Random forest | 0.5664 | 0.5766 | 0.6016 | 0.5889 | 0.5842 |
| Both | Logistic regression | 0.6755 | 0.6761 | 0.7127 | 0.6939 | 0.7302 |
| Both | Linear SVM | 0.6392 | 0.6377 | 0.6911 | 0.6658 | 0.6986 |
| Both | Random forest | 0.7552 | 0.7321 | 0.8293 | 0.7776 | 0.8326 |

Saved models:

| Feature set | Chosen model | Validation F1 | Test F1 |
|---|---|---:|---:|
| Text | Random forest | 0.8106 | 0.7762 |
| Behavior | Linear SVM | 0.7016 | 0.6786 |
| Both | Random forest | 0.8150 | 0.7776 |

The combined random forest is the model used when both journal text and routine fields are present. Its test F1 is 0.7776 and its ROC-AUC is 0.8326. Text alone is close, at F1 0.7762. Behavior alone is weaker, with ROC-AUC 0.5998.

## 4. Experiment 2 — missing input

The same 715 test segments were scored again when a whole feature group was removed, and when behavior fields were hidden at random. Hidden behavior values were filled with the training median, and a missing-value flag was added. The flags were learned by training the random forest on complete rows and on rows with 30% of behavior fields hidden.

The numbers below are copied from `reports/experiment2.csv`. F1 drop is measured from the full-data score of 0.7776.

| Condition | Model | Accuracy | Precision | Recall | F1 | ROC-AUC | F1 drop |
|---|---|---:|---:|---:|---:|---:|---:|
| Full text and behavior | Random forest | 0.7552 | 0.7321 | 0.8293 | 0.7776 | 0.8326 | 0.0000 |
| Text missing | Linear SVM | 0.5734 | 0.5552 | 0.8726 | 0.6786 | 0.5998 | 0.0990 |
| Behavior missing | Random forest | 0.7524 | 0.7275 | 0.8320 | 0.7762 | 0.8322 | 0.0014 |
| Behavior fields hidden 0% | Random forest with missing flags | 0.7510 | 0.7268 | 0.8293 | 0.7747 | 0.8354 | 0.0030 |
| Behavior fields hidden 10% | Random forest with missing flags | 0.7497 | 0.7273 | 0.8238 | 0.7726 | 0.8350 | 0.0051 |
| Behavior fields hidden 30% | Random forest with missing flags | 0.7497 | 0.7262 | 0.8266 | 0.7731 | 0.8338 | 0.0045 |
| Behavior fields hidden 50% | Random forest with missing flags | 0.7455 | 0.7210 | 0.8266 | 0.7702 | 0.8319 | 0.0074 |

If the journal is missing, the service uses the behavior model. If the routine is missing, it uses the text model. If both are present, it uses the combined model.

## 5. Experiment 3 — comparison across missingness

`reports/experiment3_f1.png` plots F1 against the share of behavior fields hidden: 0%, 10%, 30%, and 50%.

The largest drop in that curve is 0.004, from 0.775 at 0% hidden to 0.770 at 50% hidden. Removing the journal is the costly case: F1 falls by 0.099 and ROC-AUC falls from 0.833 to 0.600. Hiding individual behavior fields changes the score very little, which matches Experiment 1, where the text model already carried almost all of the signal.

## 6. Demo check

These two check-ins were sent to `POST /predict` on 6 November 2026. The same paths were exercised in the browser: a full check-in, a check-in with the journal removed, and the evaluation page.

Journal text: “I feel anxious and I cannot sleep. I worry about everything in my life.” Routine: 11:00 pm, response score 2, positive-response share 0.80, 1 reply. No voice recording.

| Check-in | Risk | Probability | Inputs used | Language card |
|---|---|---:|---|---|
| Journal and routine | High | 0.735 | Text, behavior | First-person pronouns, the words “feel” and “anxious” |
| Routine only, journal removed | Moderate | 0.541 | Behavior | Not provided |

The routine-only cues were upvote ratio, late-night writing time, karma, and comment count. Voice was not provided, so that card read “Not provided.” The evaluation page loaded all 9 Experiment 1 rows and all 7 Experiment 2 rows from `GET /metrics`, including the text-missing row with an F1 drop of 0.099.

Experiment 2 and Experiment 3 answer different questions. Experiment 2 is the full table: the journal can be missing, the routine can be missing, or some behavior fields can be hidden. Experiment 3 is only the line for 0%, 10%, 30%, and 50% of behavior fields hidden, while the journal is still there. The big loss is a missing journal (F1 drop 0.099). Hiding behavior fields changes F1 by about 0.004.

## 7. How a check-in is scored

The browser sends the journal, the four routine fields, and an optional WAV file to `POST /predict`. The server chooses the model:

| What you provide | Model |
|---|---|
| Journal and all four routine fields | Combined random forest |
| Journal only | Text random forest |
| All four routine fields only | Behavior linear SVM |
| Nothing | The server answers HTTP 400 |

A routine field that is left blank is not filled with zero. If any of the four routine fields is missing, the whole routine is left out.

Risk bands: under 0.40 is low, 0.40 to 0.70 is moderate, and above 0.70 is high. Every result includes this sentence: “This is a screening flag, not a clinical diagnosis.” The result page links to [findahelpline.com](https://findahelpline.com/).

Voice pitch, pauses, loudness, jitter, and MFCCs are shown on the Voice card. They are not columns in the trained model.

## 8. Gemini and Cartesia

Both are optional. The app still returns the model score when no key is set or every key fails.

Put keys only in `.env`, which git ignores. `.env.example` lists the names and stays empty:

- `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4`
- `CARTESIA_API_KEY_1` through `CARTESIA_API_KEY_4`
- `GEMINI_MODEL=gemini-2.5-flash`
- `CARTESIA_VERSION=2026-08-14`

The server walks the four keys in turn. If a key answers 401, 403, 408, 429, or a server error, the next key is tried for that call. The browser never sees the keys.

Gemini writes two sentences from the risk level, the probability, and the cues. It is told not to diagnose or invent symptoms. Cartesia transcribes a recording at `https://api.cartesia.ai/stt` with model `ink-whisper`. If the journal is empty, those words are scored. If the journal is already filled, the transcript is only displayed.

On the Journal step you can also press Speak. The browser writes the spoken words into the journal. That uses the computer’s speech recognition, not Cartesia.

## 9. How to run it

From the `mentel_health` folder:

```
.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

From the `mentel_health\frontend` folder:

```
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. The page sends `/api` to port 8000.

Install the Python libraries with `pip install -r requirements.txt` inside the virtual environment. Install the page libraries with `npm install` inside `frontend`.

## 10. Tests that were run

On 6 November 2026 the command `python -m unittest tests.test_screening -v` finished with 22 tests, all OK. `node tests/wav.test.mjs` printed `wav conversion ok`.

| Check | Result |
|---|---|
| 3,553 rows and the official split counts | Passed |
| Matrices 3553×3004, 3553×4, and 3553×3008 | Passed |
| Saved TF-IDF matches a fresh fit on the training split only | Passed |
| Saved models are random forest, linear SVM, and random forest | Passed |
| Voice feature names are not in the trained model | Passed |
| Experiment tables match the reported scores | Passed |
| 180 Hz sample tone has two pauses | Passed |
| Journal plus 11 pm routine is High, about 0.735 | Passed |
| Routine only is Moderate, about 0.541 | Passed |
| Journal only, with explanation forced empty, is High, about 0.713 | Passed |
| A half-filled routine is left out, not treated as zero | Passed |
| Empty input raises the 400 error | Passed |
| A transcript can supply the journal when the box is empty | Passed |
| A transcript does not replace a journal that is already filled | Passed |
| A missing transcript still returns pitch and the model score | Passed |
| Key pool skips a refused key and returns nothing if every key fails | Passed |
| `GET /health`, `GET /metrics`, and `POST /predict` | Passed |
| WAV bytes start with RIFF and WAVE | Passed |

The phone-width page at 390 pixels was opened in the browser. Welcome, Journal, and Voice did not overflow sideways. Evaluation loaded 7 table rows and 2 charts. Live calls to Gemini and Cartesia were not part of this test run. Those paths were tested by pretending the services refused the key or returned no transcript.

## 11. Limits

This is a screening flag, not a diagnosis. The posts are from Reddit, so the score may not fit other kinds of writing. Behavior features add very little once the journal is present. Voice sound is shown and is not part of the trained score. Speech on the Journal step needs a browser that can listen, such as Chrome or Edge, and permission to use the microphone.

## 12. Disclaimer

This is a screening flag, not a clinical diagnosis. A high result means the writing and routine resemble stressed posts in Dreaddit. It is not a diagnosis of depression, anxiety, or any other disorder. Users who want help are directed to a counsellor or a local health service at [findahelpline.com](https://findahelpline.com/).
