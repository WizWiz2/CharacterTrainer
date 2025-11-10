# Technical specification: Character LoRA One‑Click (for Easy Diffusion + dreamshaper_8)

## 0) Summary
**Goal:** turn a curated set of reference images (photos/art) into a ready-to-use character LoRA with a single command and drop it into the Easy Diffusion LoRA folder. Primary target base model — **dreamshaper_8 (SD1.5 family)**.

**Key scenario:**
1. The user collects 12–25 reference images of a character.
2. Runs the one-click pipeline.
3. Receives the output: LoRA file path, recommended weight, inference tips.

The script handles (1) dataset preparation → (2) LoRA training (local or remote GPU) → (3) copying `.safetensors` into the Easy Diffusion LoRA directory → (4) providing the trigger token and recommended weight.

## 1) Scope and value
- Consistent images of a single character across scenes and styles.
- Minimal friction for the user: “drop photos → get LoRA → use in ED”.
- Technical focus: orchestrate dataset prep and training with no manual routine.

**Out of scope (MVP):** hosted/cloud UI, payments, multi-tenant hosting, full DreamBooth.

## 2) Compatibility and assumptions
- **Base:** SD1.5. Target checkpoint — **dreamshaper_8**; for compatibility, train LoRA on **dreamshaper_8** or the closest SD1.5 checkpoint.
- **Easy Diffusion (ED):** already installed locally (macOS). The LoRA folder path is provided via config.
- **GPU training:**
  - Locally (Linux + NVIDIA + Docker) **or**
  - Remote Linux server via SSH (NVIDIA + Docker).
- macOS acts as the orchestrator (launch command, copy artifacts to ED). If no local CUDA is available, training happens on a remote server.

## 3) User flow (One‑Click)
1. The user gathers 12–25 references (different angles/lighting/emotions; minimal heavy retouching).
2. Runs the command:
   ```
   charlora train \
     --name sofia \
     --trigger svtchar \
     --images ./refs/*.jpg
   ```
3. Output:
   - LoRA path: `<ED_LORA_DIR>/sofia_lora_ds8_v1.safetensors`
   - **Recommended weight:** `0.7–0.85`
   - Tips on sampler/CFG/steps for ED

## 4) Architecture and components
```
charactertrainer/
├─ backend/
│  ├─ app/
│  │  ├─ main.py           # FastAPI endpoints
│  │  └─ training.py       # Pipeline orchestration
│  ├─ data/jobs/<id>/      # datasets, logs, metadata
│  ├─ artifacts/ed_lora/   # ready-to-copy LoRAs
│  └─ config.yaml          # model paths, hyperparams, modes
├─ frontend/
│  └─ src/                 # React + Tailwind UI
├─ scripts/
│  └─ up.ps1               # Windows Docker launcher
├─ kohya_ss/               # mounted repo for training
└─ docs/
```
Supporting pieces:
- `prep_faces.py` — dataset prep (crop/resize/captions).
- `make_lora.sh` — launches training (local/SSH) and copies artifact.
- `config.yaml` — paths, hyperparameters, modes.
- `prompts/*.passport.json` — character “passport” (meta + hints).

Training uses kohya_ss (Docker). Optional later additions: InsightFace/BLIP for better preprocessing and captions.

## 5) Configuration (example `config.yaml`)
```
base_model:
  use: "ds8"
  ds8: "/srv/models/external/dreamshaper_8.safetensors"
  sd15: "/srv/models/external/v1-5-pruned-emaonly.safetensors"

local_docker: false  # Mac as orchestrator; training via SSH

train:
  resolution: 512
  steps: 2500
  network_dim: 32
  unet_only: true
  lr_unet: 0.0001
  lr_text: 0.00005
  noise_offset: 0.05
  caption_dropout: 0.1
  save_every: 500
```
> Note: dreamshaper_8 (SD1.5) pairs best with **resolution=512**. Portraits may benefit from 640/768, but 512 is the safe default for VRAM.

## 6) Dataset preparation (MVP)
- Supported formats: JPG/PNG/WEBP.
- Preprocess: crop to square with padding → resize to `resolution × resolution` → save.
- Captions: simple `<idx>.txt` files with trigger token and base traits (can swap for BLIP/manual later).
- Generate a character “passport” (`<name>.passport.json`) with trigger token, negative prompt template, inference hints.

**Minimum data quality:**
- At least 8 images (12–25 recommended).
- Variety of angles: front/¾/profile + 1–2 full-body shots.
- Consistent features (eyes, hair, scars, etc.) repeated across images.
- Mixed lighting (not only studio setups).

## 7) LoRA training (kohya_ss, SD1.5)
- Train on **dreamshaper_8** (recommended) or base SD1.5.
- Start with `UNet only`. If the likeness is weak, add light text-encoder training (`lr_text` low).
- Monitor overfitting: save checkpoints every `save_every` steps; evaluate with 2–3 prompts.

**Command concept (Docker):**
```
python -m accelerate.launch train_network.py \
  --config_file=config/train_config.json \
  --network_module=lycoris.kohya \
  --network_dim=32 \
  --train_data_dir=... \
  --output_dir=...
```

## 8) UI and UX
**MVP (web):**
- React + Tailwind (see prototype).
- Screen: character name/trigger/base model/training params, upload 8–25 files.
- CTA: “▶︎ Start One‑Click”.
- Status panel: current state (idle/prepping/training/copying/done), live log, artifact path, ED tips.
- Footer buttons: “Open LoRA folder”, “Export character passport”, “Generate 3 test scenes”.

**Later:**
- Wrap in Tauri → desktop app with FS access, Finder/Explorer integration.
- SSH profiles (choose remote GPU).
- Fine-tune mode: `charlora finetune` from UI.

## 9) API contracts (FastAPI backend)
- `POST /train` → start training job; returns `{ job_id }`.
- `GET /jobs/{id}/status` → `{ state, logs, artifact_path?, error? }`.
- `POST /config/test` → environment check (`{ ok, ed_lora_dir, docker?, ssh?, message? }`).

## 10) Artifact deployment to Easy Diffusion
- On completion, save `<name>_lora_ds8_v1.safetensors` into `ed_lora_dir`.
- Script prints:
  - artifact path,
  - recommended weight (0.7–0.85),
  - sampler tips: DPM++ 2M Karras, CFG 4–6, 28–40 steps.
- Verification in ED: choose base **dreamshaper_8**, attach LoRA, supply prompt with `trigger_token`, optionally add ControlNet (OpenPose/Depth).

## 11) Acceptance criteria (MVP)
1. Single `charlora train` command runs end-to-end with no manual steps.
2. New LoRA appears in ED, selectable without errors.
3. Three test scenes (portrait, waist-up, full body) produce a recognizable character ≥2/3 times.
4. Web UI shows status/logs, artifact path, and ED hints.
5. Documentation: README with setup, example `config.yaml`, FAQ, “How to get the best results”.

## 12) Risks and mitigation
- **LoRA/base incompatibility:** train on the same family as inference (dreamshaper_8/SD1.5).
- **Overfitting/style drift:** monitor steps, keep diverse refs, version checkpoints (`v1/v2`).
- **Insufficient VRAM:** reduce `resolution`/`network_dim`/batch; stay on SD1.5 instead of SDXL.
- **Data quality:** provide dataset checklist and warnings (monotone angles, heavy retouching).

## 13) Feature backlog (post-MVP)
- InsightFace cropping, BLIP captions + manual editor.
- IP-Adapter FaceID/InstantID support at inference.
- Fine-tune mode (`finetune`) and versioning.
- Automatic similarity eval (face embeddings, %).
- Tauri desktop shell.
- Scene presets (portrait/action/full-body).
- Batch training for multiple characters.
- Privacy policy / NSFW check.

## 14) Repository structure
```
charactertrainer/
├─ backend/app        # FastAPI
├─ backend/config.yaml
├─ backend/data       # datasets & logs (gitignored)
├─ backend/artifacts  # output LoRAs for ED
├─ frontend/          # React UI
├─ scripts/           # helper scripts
├─ kohya_ss/          # mounted sd-scripts repo
└─ work/              # temporary data (gitignored)
```

## 15) Dataset checklist (for the user)
- [ ] 12–25 images, 3+ angles (front/¾/profile), 2+ emotions, 1–2 full-body shots.
- [ ] Minimal heavy filters or retouching.
- [ ] Consistent features (hair/eye color, scars, etc.) appear multiple times.
- [ ] Varied lighting (not only studio).
- [ ] Character name and trigger token configured.

## 16) Quick guide for Easy Diffusion
1. Choose base model **dreamshaper_8**.
2. Load LoRA `<name>_lora_ds8_v1` with weight 0.7–0.85.
3. Prompt: `svtchar, consistent character, <describe traits> …`
4. Sampler: DPM++ 2M Karras; Steps: 28–40; CFG: 4–6; optional ControlNet (OpenPose/Depth) for poses.

## 17) Licenses and rights
- Code: MIT (default).
- The user confirms they own the rights to provided images. Data stays local; nothing is uploaded to third parties (except the remote GPU server chosen by the user).
