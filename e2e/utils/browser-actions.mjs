export function navigate(page, path) {
  return page.goto(path);
}

export function click(locator) {
  return locator.click();
}

export function fillInput(locator, value) {
  return locator.fill(value);
}

export function selectOption(locator, value) {
  return locator.selectOption(value);
}

export function check(locator) {
  return locator.check();
}