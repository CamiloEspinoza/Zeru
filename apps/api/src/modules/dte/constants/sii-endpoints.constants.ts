export const SII_ENVIRONMENTS = {
  CERTIFICATION: {
    host: 'maullin.sii.cl',
    SEED_WSDL: 'https://maullin.sii.cl/DTEWS/CrSeed.jws?WSDL',
    TOKEN_WSDL: 'https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws?WSDL',
    DTE_UPLOAD: 'https://maullin.sii.cl/cgi_dte/UPL/DTEUpload',
    QUERY_UPLOAD: 'https://maullin.sii.cl/DTEWS/QueryEstUp.jws?WSDL',
    QUERY_DTE: 'https://maullin.sii.cl/DTEWS/QueryEstDte.jws?WSDL',
    QUERY_DTE_AV: 'https://maullin.sii.cl/DTEWS/services/QueryEstDteAv?wsdl',
    DTE_CORREO: 'https://maullin.sii.cl/DTEWS/services/wsDTECorreo?wsdl',
    RECLAMO: 'https://ws2.sii.cl/WSREGISTRORECLAMODTECERT/registroreclamodteservice?wsdl',
    BOLETA_BASE: 'https://apicert.sii.cl/recursos/v1',
    PORTAL_AUTH: 'https://herculesr.sii.cl/cgi_AUT2000/CAutInicio.cgi',
    CONSULTA_RUT: 'https://maullin.sii.cl/cvc_cgi/dte/ce_consulta_rut',
    SOLICITA_FOLIOS: 'https://maullin.sii.cl/cvc_cgi/dte/of_solicita_folios',
  },
  PRODUCTION: {
    host: 'palena.sii.cl',
    SEED_WSDL: 'https://palena.sii.cl/DTEWS/CrSeed.jws?WSDL',
    TOKEN_WSDL: 'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws?WSDL',
    DTE_UPLOAD: 'https://palena.sii.cl/cgi_dte/UPL/DTEUpload',
    QUERY_UPLOAD: 'https://palena.sii.cl/DTEWS/QueryEstUp.jws?WSDL',
    QUERY_DTE: 'https://palena.sii.cl/DTEWS/QueryEstDte.jws?WSDL',
    QUERY_DTE_AV: 'https://palena.sii.cl/DTEWS/services/QueryEstDteAv?wsdl',
    DTE_CORREO: 'https://palena.sii.cl/DTEWS/services/wsDTECorreo?wsdl',
    RECLAMO: 'https://ws1.sii.cl/WSREGISTRORECLAMODTE/registroreclamodteservice?wsdl',
    BOLETA_BASE: 'https://api.sii.cl/recursos/v1',
    PORTAL_AUTH: 'https://herculesr.sii.cl/cgi_AUT2000/CAutInicio.cgi',
    CONSULTA_RUT: 'https://palena.sii.cl/cvc_cgi/dte/ce_consulta_rut',
    SOLICITA_FOLIOS: 'https://palena.sii.cl/cvc_cgi/dte/of_solicita_folios',
  },
} as const;

export type SiiEnvironmentKey = keyof typeof SII_ENVIRONMENTS;
