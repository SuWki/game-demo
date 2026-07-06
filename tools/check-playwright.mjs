try {
  await import('playwright');
  console.log('playwright OK');
} catch {
  console.log('playwright NOT FOUND');
}
