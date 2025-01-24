const express = require('express');
const { sql, poolPromise } = require('./db');
const router = express.Router();

// Consulta de estoque
router.get('/stock', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query(`
                SELECT DISTINCT 
                    SB2.B2_FILIAL AS FILIAL,
                    SB2.B2_COD AS CODPROD,
                    SB1.B1_DESC AS DESCRICAO,
                    SB2.B2_QATU AS QUANTIDADE,
                    SB2.B2_LOCAL AS LOCAL,
                    SB1.B1_ATIVO AS ATIVO,
                    SB2.D_E_L_E_T_
                FROM SB2010 SB2
                LEFT JOIN SB1010 SB1 
                    ON SB2.B2_COD = SB1.B1_COD 
                    AND SUBSTRING(SB2.B2_FILIAL, 1, 2) = SB1.B1_FILIAL 
                WHERE   
                    SB2.B2_FILIAL = '010101' AND
                    SB2.D_E_L_E_T_ = '' AND 
                    SB2.B2_LOCAL = '06'
                ORDER BY SB2.B2_QATU ASC;
            `);
        res.status(200).send(result.recordset);
    } catch (err) {
        console.error('Erro na consulta de estoque:', err);
        res.status(500).send('Erro ao consultar o estoque');
    }
});

module.exports = router;
