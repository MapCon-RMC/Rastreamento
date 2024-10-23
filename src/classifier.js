// Determines whether or not a given article's subject
// is related to "Urban conflicts" and "Curitiba".
function classifier(body) {
    // Number defines the amount of matching words needed to classify
    // the article as a protest.
    // 1: High confidence, 2: Medium confidence, ...
    const keywordsDict = {
        " conflito":      1,
        " comunidade":    2,
        " protesto":      1,
        " protestam":     1,
        " manifestação":  1,
        " manifestante":  1,
        " moradores":     2,
        " greve":         1,
        " paralisação":   1,
        " passeata":      2,
        " bloqueio":      2,
        " confronto":     2,
        " violento":      2,
        " tensão":        2,
        " tumulto":       1,
        " invasão":       1,
        " invasões":      2,
        " ocupação":      1,
        " ocupações":     1,
        " desocupação":   1,
        " desalojamento": 1,
        " deslocamento":  2,
        " reintegração":  1,
    };
    // Normalize the body content to lowercase
    const normalizedBody = body.toLowerCase();
    let termos = [];
    let found = false;
    for (const keyword in keywordsDict) {
        if (normalizedBody.includes(keyword)) {
            termos.push((keyword));
            for(const key of termos) {
                if (Object.keys(termos).length >= keywordsDict[key])
                    found = true;
            }
        }
    }
    return [found, termos];
}

// -====================================================================- //

// Filters URL from "https://www.tribunapr.com.br/noticias/parana/"
// that is not an actual article. 
function filter_TRIBUNAPR(URL) {
    const exclude_list = [
                            "/page/",
                         ];
    if (URL.includes("www.tribunapr.com.br/noticias/curitiba-regiao/") && URL.split("//")[1] !== "www.tribunapr.com.br/noticias/curitiba-regiao/") {
        for (const element of exclude_list) {
            if (URL.includes(element)) return false;
        }
        return true;
    }
}

// Filters URL from "http://www.brasildefatopr.com.br/"
// that is not an actual article. 
const dateRegex = /\/(\d{4})\/(\d{2})\/(\d{2})\//;
function filter_BRASILDEFATOPR(URL) {
    return dateRegex.test(URL);
}

// Filters URL from "http://www.bemparana.com.br/"
// that is not an actual article.  
function filter_BEMPARANA(URL) {
    return URL.includes("www.bemparana.com.br/noticias/parana/") &&
            URL.split("//")[1] !== "www.bemparana.com.br/noticias/parana/";
}

// Filters URL from "https://bandnewsfmcuritiba.com/"
// that is not an actual article.  
function filter_BANDNEWSCURITIBA(URL) {
    const exclude_list = ["/ultimas-noticias/",
                          "editoria",
                          "/institucional",
                          "/contato",
                          "/arquivo/",
                          "/endereco",
                          "episodio",
                          "/colunas/",
                          "/especiais",
                          "/author/",
                          "/curitiba/",
                          "/estado-parana/",
                          "/politica_cat/",
                          "/esportes",
                          "ep-",
                        ];
    if (URL.includes("bandnewsfmcuritiba.com") && URL.split("//")[1].split("/").length === 3) {
        for (const element of exclude_list) {
            if (URL.includes(element)) return false;
        }
        return true;
    }    
}

// Filters URL from "https://www.bandab.com.br/"
// that is not an actual article.  
function filter_BANDAB(URL) {
    return URL.includes("www.bandab.com.br/curitiba/") && URL.split("//")[1] !== "www.bandab.com.br/curitiba/";
}


// Filters URL by subdomain.
// IMPORTANT: All URL in the list must be from the same domain.
function filter_URL(URL) {
    if (URL.includes("www.tribunapr.com.br/")) {
        return filter_TRIBUNAPR(URL);       //
    } else if (URL.includes("www.brasildefatopr.com.br/")) {
        return filter_BRASILDEFATOPR(URL);  //
    } else if (URL.includes("www.bemparana.com.br/")) {
        return filter_BEMPARANA(URL);       //
    } else if (URL.includes("bandnewsfmcuritiba.com/")) {
        return filter_BANDNEWSCURITIBA(URL);//
    } else if (URL.includes("www.bandab.com.br/")) {
        return filter_BANDAB(URL);          //
    }
}

export { classifier, filter_URL };