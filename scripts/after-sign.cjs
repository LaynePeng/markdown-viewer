const { execFile } = require('child_process');
const path = require('path');

exports.default = async function afterSign(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const args = ['--force', '--deep', '--sign', '-', appPath];

  await new Promise((resolve, reject) => {
    execFile('codesign', args, (err, _stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message || '').trim()));
      else resolve();
    });
  });
};