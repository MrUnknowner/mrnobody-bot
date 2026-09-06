const cinesubz = require("cinesubz-scraper");
const sinhalasub = require("dark-yasiya-sinhalasub.lk");

function pickFunction(module, names) {
    for (const name of names) {
        if (typeof module?.[name] === "function") {
            return module[name];
        }
        if (typeof module?.default?.[name] === "function") {
            return module.default[name];
        }
    }
    return null;
}

async function callFirst(module, names, args) {
    const fn = pickFunction(module, names);
    if (!fn) {
        throw new Error(`No supported function found: ${names.join(", ")}`);
    }
    return fn(...args);
}

function flatten(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.results)) return value.results;
    if (Array.isArray(value?.movies)) return value.movies;
    return [];
}

function normalizeMovie(item, source) {
    if (!item || typeof item !== "object") return null;

    const title =
        item.title ||
        item.name ||
        item.movieName ||
        item.movie_name ||
        item.text ||
        null;

    const url =
        item.url ||
        item.link ||
        item.href ||
        item.movieUrl ||
        item.movie_url ||
        null;

    if (!title && !url) return null;

    return {
        source,
        title: String(title || url),
        url: url ? String(url) : null,
        raw: item
    };
}

async function searchProvider(module, source, query) {
    const functions = source === "cinesubz"
        ? ["search", "searchMovies", "getMoviesSearch", "getMovies"]
        : ["getMoviesSearch", "search", "searchMovies", "getMovies"];

    let result = null;
    let lastError = null;

    for (const name of functions) {
        const fn = pickFunction(module, [name]);
        if (!fn) continue;

        try {
            result = await fn(query);
            break;
        } catch (error) {
            lastError = error;
        }
    }

    if (result == null && lastError) throw lastError;

    return flatten(result)
        .map((item) => normalizeMovie(item, source))
        .filter(Boolean);
}

async function search(query) {
    const q = String(query || "").trim();
    if (!q) return [];

    const results = [];

    // A failure from one unofficial provider must not hide results from the other.
    for (const [module, source] of [
        [cinesubz, "cinesubz"],
        [sinhalasub, "sinhalasub"]
    ]) {
        try {
            const items = await searchProvider(module, source, q);
            results.push(...items);
        } catch (error) {
            console.error(`[${source}] search failed:`, error.message);
        }
    }

    const seen = new Set();
    return results.filter((item) => {
        const key = `${item.source}:${item.url || item.title}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 10);
}

async function getDownloadInfo(movie) {
    if (!movie?.raw) {
        throw new Error("Movie result is invalid.");
    }

    const module = movie.source === "cinesubz" ? cinesubz : sinhalasub;

    const functions = movie.source === "cinesubz"
        ? ["getMovieDL", "download", "getDownloadLinks", "getMovieDownload"]
        : ["getMovieDL", "download", "getDownloadLinks", "getMovieDownload"];

    let lastError = null;

    for (const name of functions) {
        const fn = pickFunction(module, [name]);
        if (!fn) continue;

        const args = movie.url ? [movie.url] : [movie.raw];
        try {
            const result = await fn(...args);
            return normalizeDownloadResult(result, movie);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error(`No supported downloader found for ${movie.source}.`);
}

function normalizeDownloadResult(result, movie) {
    if (!result) throw new Error("Movie downloader returned no data.");

    if (typeof result === "string") {
        return {
            title: movie.title,
            source: movie.source,
            links: [{ quality: null, url: result }]
        };
    }

    const rawLinks =
        result.links ||
        result.downloads ||
        result.data ||
        result.results ||
        result.urls ||
        result;

    const list = Array.isArray(rawLinks) ? rawLinks : [rawLinks];

    const links = list
        .filter((item) => item != null)
        .map((item) => {
            if (typeof item === "string") {
                return { quality: null, url: item };
            }

            return {
                quality:
                    item.quality ||
                    item.resolution ||
                    item.label ||
                    item.name ||
                    null,
                url:
                    item.url ||
                    item.link ||
                    item.downloadUrl ||
                    item.download_url ||
                    item.href ||
                    null
            };
        })
        .filter((item) => item.url);

    if (!links.length) {
        throw new Error("Movie downloader returned no usable links.");
    }

    return {
        title: movie.title,
        source: movie.source,
        links
    };
}

module.exports = {
    search,
    getDownloadInfo
};
