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
def main(prebuilt_image: str = "") -> None:
    if prebuilt_image and "@sha256:" not in prebuilt_image:
        raise ValueError("A prebuilt runner image must be pinned by registry digest")
    image = (
        modal.Image.from_registry(prebuilt_image, add_python="3.13")
        if prebuilt_image
        else runner_image
    )
    image.build(app)
    image.publish(RUNNER_IMAGE_NAME)
