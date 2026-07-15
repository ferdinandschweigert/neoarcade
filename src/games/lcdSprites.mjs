export function createLcdSpriteAtlas(source) {
  if (typeof Image === "undefined") {
    return null;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = source;
  return image;
}

export function drawLcdSprite(ctx, atlas, column, row, x, y, width, height) {
  if (!atlas?.complete || !atlas.naturalWidth || !atlas.naturalHeight) {
    return false;
  }

  const sourceWidth = atlas.naturalWidth / 2;
  const sourceHeight = atlas.naturalHeight / 2;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    atlas,
    column * sourceWidth,
    row * sourceHeight,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
  ctx.imageSmoothingEnabled = smoothing;
  return true;
}
