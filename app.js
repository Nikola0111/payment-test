const express = require("express");
const request = require("request");
const path = require("path");

const app = express();
const PORT = 6600;

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
    res.redirect("/auth3d");
});

app.get("/auth3d", (req, res) => {
    const { token, data } = req.query;

    const missing = [];
    if (!token) missing.push("token");
    if (!data) missing.push("data");

    if (missing.length > 0) {
        console.error(`[auth3d] Missing query params: ${missing.join(", ")} | ip=${req.ip} | url=${req.originalUrl}`);
        return res.status(400).render("error", {
            message: `Missing required parameters: ${missing.join(", ")}`,
        });
    }

    console.log(`[auth3d] Redirecting to 3DS | token=${token.substring(0, 8)}...`);
    res.render("hello", {
        token: token,
        e_data: decodeURIComponent(data),
    });
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
