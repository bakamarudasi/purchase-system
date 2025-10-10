function doGet(_e: GoogleAppsScript.Events.DoGet) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('購入申請システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
