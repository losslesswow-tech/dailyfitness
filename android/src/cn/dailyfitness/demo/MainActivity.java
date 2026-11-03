package cn.dailyfitness.demo;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.AtomicFile;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.HashMap;

/** A network-free Android host. Only bundled assets can access the persistence bridge. */
public final class MainActivity extends Activity {
    private WebView web;
    private AtomicFile store;
    private String pendingExport;
    private static final int EXPORT = 100, IMPORT = 101, LIMIT = 4_000_000;
    private static final String ORIGIN = "https://appassets.androidplatform.net";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        store = new AtomicFile(new File(getFilesDir(), "dailyfitness-v2.json"));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(245,246,241));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.getSettings().setSupportZoom(false);
        web.getSettings().setBuiltInZoomControls(false);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidStore");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                String path = uri.getPath();
                if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && path != null && path.startsWith("/assets/") && !path.contains("..")) {
                    try {
                        String name = path.substring(8);
                        String mime = name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "application/javascript" : name.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
                        HashMap<String,String> headers = new HashMap<>();
                        headers.put("Cache-Control", "no-store");
                        headers.put("X-Content-Type-Options", "nosniff");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, getAssets().open(name));
                    } catch (Exception e) { return denied(); }
                }
                return denied();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost()) && "/assets/index.html".equals(uri.getPath())) return false;
                boolean projectLink = "github.com".equals(uri.getHost()) && uri.getPath() != null && (uri.getPath().equals("/losslesswow-tech/dailyfitness") || uri.getPath().startsWith("/losslesswow-tech/dailyfitness/"));
                if ("https".equals(uri.getScheme()) && (projectLink || "www.nal.usda.gov".equals(uri.getHost()) || "fdc.nal.usda.gov".equals(uri.getHost()) || "pubmed.ncbi.nlm.nih.gov".equals(uri.getHost()) || "data.gov.tw".equals(uri.getHost()) || "pacompendium.com".equals(uri.getHost()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception e) { message("没有可打开链接的浏览器", "No browser is available to open this link"); }
                }
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN + "/assets/index.html");
    }

    private WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    public final class Bridge {
        @JavascriptInterface public String getLanguage() { return language(); }
        @JavascriptInterface public boolean setLanguage(String value) {
            if (!"zh-CN".equals(value) && !"en".equals(value)) return false;
            return getSharedPreferences("preferences", MODE_PRIVATE).edit().putString("language", value).commit();
        }
        @JavascriptInterface public String load() {
            synchronized (MainActivity.this) {
                if (!store.getBaseFile().exists() && !new File(store.getBaseFile().getPath()+".bak").exists()) return "";
                try { return new String(store.readFully(), StandardCharsets.UTF_8); }
                catch (Exception e) { return "unreadable-records"; }
            }
        }
        @JavascriptInterface public boolean save(String json) {
            synchronized (MainActivity.this) {
                FileOutputStream stream = null;
                try {
                    if (json == null || json.length() > LIMIT || new JSONObject(json).getInt("version") != 2) return false;
                    stream = store.startWrite();
                    stream.write(json.getBytes(StandardCharsets.UTF_8));
                    store.finishWrite(stream);
                    return true;
                } catch (Exception e) { if (stream != null) store.failWrite(stream); return false; }
            }
        }
        @JavascriptInterface public void exportBackup(String json) {
            runOnUiThread(() -> {
                if (pendingExport != null) { message("请先完成当前导出", "Finish the current export first"); return; }
                pendingExport = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "dailyfitness-backup.json");
                try { startActivityForResult(intent, EXPORT); }
                catch (Exception e) { pendingExport = null; message("无法打开文件保存器", "Could not open the file saver"); }
            });
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(intent, IMPORT); } catch (Exception e) { message("无法打开文件选择器", "Could not open the file picker"); }
            });
        }
        @JavascriptInterface public void finishApp() { runOnUiThread(() -> finish()); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == EXPORT) {
            String export = pendingExport;
            pendingExport = null;
            if (result != RESULT_OK || data == null || export == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                if (out == null) throw new Exception();
                out.write(export.getBytes(StandardCharsets.UTF_8));
                message("备份已保存", "Backup saved");
            } catch (Exception e) { message("导出失败，请重新选择保存位置", "Export failed. Choose another save location"); }
        } else if (request == IMPORT && result == RESULT_OK && data != null) {
            try (InputStream in = getContentResolver().openInputStream(data.getData()); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                if (in == null) throw new Exception();
                byte[] buffer = new byte[8192]; int count;
                while ((count = in.read(buffer)) != -1) {
                    if (out.size() + count > LIMIT) { message("备份文件不能超过 4 MB", "Backup files must not exceed 4 MB"); return; }
                    out.write(buffer, 0, count);
                }
                String raw = new String(out.toByteArray(), StandardCharsets.UTF_8);
                web.evaluateJavascript("window.onNativeImport(" + JSONObject.quote(raw) + ")", null);
            } catch (Exception e) { message("无法读取备份文件，原记录未更改", "Could not read backup. Original records are unchanged"); }
        }
    }
    private String language() {
        String fallback = "zh".equals(Locale.getDefault().getLanguage()) ? "zh-CN" : "en";
        return getSharedPreferences("preferences", MODE_PRIVATE).getString("language", fallback);
    }
    private void message(String chinese, String english) {
        String text = "en".equals(language()) ? english : chinese;
        runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show());
    }
    @Override public void onBackPressed() { web.evaluateJavascript("window.onNativeBack && window.onNativeBack()", null); }
    @Override protected void onDestroy() { web.removeJavascriptInterface("AndroidStore"); web.destroy(); super.onDestroy(); }
}
