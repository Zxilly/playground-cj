from pathlib import Path

import modal


APP_NAME = "playground-cj-runner-image-build"
RUNNER_IMAGE_NAME = "playground-cj-runner-runtime"
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
RUNNER_ROOT = REPOSITORY_ROOT / "cj-runner"

app = modal.App(APP_NAME)
runner_image = modal.Image.from_dockerfile(
    RUNNER_ROOT / "Dockerfile",
    context_dir=RUNNER_ROOT,
    add_python="3.13",
)


@app.local_entrypoint()
def main() -> None:
    runner_image.build(app)
    runner_image.publish(RUNNER_IMAGE_NAME)
