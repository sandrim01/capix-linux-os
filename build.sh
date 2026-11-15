#!/usr/bin/env bash
# Capix Linux OS — build
#   ./build.sh            -> gera assets + imagem do sistema (container bootc)
#   ./build.sh iso        -> + ISO instalável (Anaconda) em ./output
#   ./build.sh vm         -> + disco qcow2 para testar em VM (usuário capix / senha capix)
#   ./build.sh preview    -> só gera preview/capix-preview.html
# Placa de vídeo:
#   CAPIX_GPU=open    (padrão) -> AMD e Intel, drivers open source (Mesa/Vulkan)
#   CAPIX_GPU=nvidia           -> também embute o driver NVIDIA proprietário (imagem capix-nvidia)
# Requisitos: Linux com podman, node >= 18, rsvg-convert. (Fedora: sudo dnf install podman nodejs librsvg2-tools ImageMagick)
set -euo pipefail
cd "$(dirname "$0")"
FEDORA_VERSION="${FEDORA_VERSION:-44}"
GPU="${CAPIX_GPU:-open}"
# Para atualizações automáticas nas máquinas instaladas, publique a imagem num registro
# (ex.: GitHub Actions -> ghcr.io) e gere a ISO a partir dela:
#   CAPIX_IMAGE=ghcr.io/SEU_USUARIO/capix:44 ./build.sh iso
SUFFIX=""; [ "$GPU" = nvidia ] && SUFFIX="-nvidia"
IMAGE="${CAPIX_IMAGE:-localhost/capix${SUFFIX}:${FEDORA_VERSION}}"
BIB="quay.io/centos-bootc/bootc-image-builder:latest"

echo "==> Gerando arte (capivara, splash, wallpaper, tema de login)"
node tools/render-assets.mjs
node tools/build-preview.mjs
[ "${1:-}" = "preview" ] && exit 0

if [[ "$IMAGE" == localhost/* ]]; then
  echo "==> Construindo a imagem base ($GPU)"
  sudo podman build --build-arg FEDORA_VERSION="$FEDORA_VERSION" -t "localhost/capix:${FEDORA_VERSION}" .
  if [ "$GPU" = nvidia ]; then
    echo "==> Adicionando o driver NVIDIA ($IMAGE)"
    sudo podman build -f Containerfile.nvidia --build-arg FEDORA_VERSION="$FEDORA_VERSION" \
      --build-arg BASE="localhost/capix:${FEDORA_VERSION}" -t "$IMAGE" .
  fi
else
  echo "==> Baixando a imagem publicada ($IMAGE)"
  sudo podman pull "$IMAGE"
fi

case "${1:-}" in
  iso|vm)
    # MOUNT: volume do podman (antes da imagem do BIB)  |  BIBARG: argumento do BIB (depois)
    TYPE=anaconda-iso
    MOUNT=(-v "$PWD/config/iso-interactive.toml:/config.toml:ro"); BIBARG=(--config /config.toml)
    if [ "$1" = vm ]; then
      TYPE=qcow2
      MOUNT=(-v "$PWD/config/vm-user.toml:/config.toml:ro"); BIBARG=(--config /config.toml)
    fi
    mkdir -p output
    echo "==> Gerando $TYPE"
    sudo podman run --rm -it --privileged --pull=newer \
      --security-opt label=type:unconfined_t \
      -v "$PWD/output:/output" \
      -v /var/lib/containers/storage:/var/lib/containers/storage \
      "${MOUNT[@]}" \
      "$BIB" --type "$TYPE" --rootfs btrfs "${BIBARG[@]}" "$IMAGE"
    echo "==> Pronto: $(ls -d output/*)"
    ;;
esac
