
export async function usePageOfSource(req, res) {
    const sourceMap = res.locals.sourceMap;
    const path = "/" + req.params[0];

    if (sourceMap.has(path)) {
        const source = sourceMap.get(path);

        const id = req.params.id;
        const page = await source.getPage(id);
        if (page == null) {
            res.status(404).send(`The page with this ID does not exist`);
        } else {
            const contentType = 'text/turtle'
            const s = await page.getSerializedPage(contentType);
            res.setHeader("Content-Type", contentType);
            if (page.isImmutable) res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
            s.pipe(res);
        }
    }
    else {
        //console.error(`The endpoint ${path} does not exist`)
        res.status(404).send(`The endpoint ${path} does not exist`);
    }

}
