const express = require("express");
const request = require("request");

const app = express();
const PORT = 6600;

app.use(express.urlencoded({ extended: true }));

function renderAuth3dPage(token, encryptedData) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>3D Secure Authentication</title>
  </head>
  <body>
    <p>Redirecting to 3D Secure...</p>
    <form
      id="pay3D"
      action="https://entegrasyon.asseco-see.com.tr/msu/api/v2/post/auth3d/${token}"
      method="post"
    >
      <input type="hidden" name="encryptedData" value="${encryptedData}" />
    </form>
    <script>
      document.getElementById("pay3D").submit();
    </script>
  </body>
</html>`;
}

function renderErrorPage(message) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
      }
      .error-card {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        padding: 2.5rem 2rem;
        max-width: 420px;
        width: 100%;
        text-align: center;
      }
      .error-icon { font-size: 3rem; color: #dc3545; margin-bottom: 1rem; }
      h1 { font-size: 1.25rem; color: #333; margin-bottom: 0.75rem; }
      p { color: #666; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="error-card">
      <div class="error-icon">&#x26A0;</div>
      <h1>Something went wrong</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

app.get("/auth3d", (req, res) => {
    const { token, data } = req.query;

    const missing = [];
    if (!token) missing.push("token");
    if (!data) missing.push("data");

    if (missing.length > 0) {
        console.error(`[auth3d] Missing query params: ${missing.join(", ")} | ip=${req.ip} | url=${req.originalUrl}`);
        return res.status(400).send(renderErrorPage(`Missing required parameters: ${missing.join(", ")}`));
    }

    console.log(`[auth3d] Redirecting to 3DS | token=${token.substring(0, 8)}...`);
    res.send(renderAuth3dPage(token, data));
});

function doSale(options) {
    return new Promise((resolve, reject) => {
        request(options, (err, response) => {
            if (err) return reject(err);
            try {
                return resolve(JSON.parse(response.body));
            } catch (e) {
                return reject(new Error("Invalid MSU response"));
            }
        });
    });
}

app.post("/sale", async (req, res) => {
    try {
        const { sessionToken, auth3DToken, saveCard = "YES" } = req.body;

        if (!sessionToken || !auth3DToken) {
            console.error(`[sale] Missing params | sessionToken=${!!sessionToken} auth3DToken=${!!auth3DToken}`);
            return res.status(400).json({
                success: false,
                message: "Missing required parameters",
            });
        }

        console.log(`[sale] Processing | token=${sessionToken.substring(0, 8)}...`);

        const postOptions = {
            method: "POST",
            url: "https://entegrasyon.asseco-see.com.tr/msu/api/v2",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            form: {
                ACTION: "SALE",
                SESSIONTOKEN: sessionToken,
                AUTH3DTOKEN: auth3DToken,
                SAVECARD: saveCard,
            },
        };

        const msuResponse = await doSale(postOptions);
        console.log(`[sale] Success | token=${sessionToken.substring(0, 8)}...`);

        return res.json({ success: true, msuResponse });
    } catch (error) {
        console.error("[sale] Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "SALE transaction failed",
            error: error.message,
        });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port: ${PORT}`);
    });
}

module.exports = app;
