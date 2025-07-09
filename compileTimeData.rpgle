     H/INCLUDE  coztools/qcpysrc,cozHeader

      /INCLUDE  coztools/qcpysrc,const
      /INCLUDE  coztools/qcpysrc,QUSEC
      /INCLUDE  coztools/qcpysrc,frcb
      /INCLUDE  coztools/qcpysrc,ceeProtos
      /INCLUDE  coztools/qcpysrc,apiProtos
      /INCLUDE  coztools/qcpysrc,cvtcase
     FITEMS    IF   E           K DISK
     IITEMS    NS  01
     I                                          20  DESC
     I                                          30  PRICE
     C           READ      ITEMS
     C           DOU       %EOF(ITEMS)
     C           EVAL      DESC  = ITEMDESC
     C           EVAL      PRICE = ITEMPRICE
     C           EXSR
     C           READ      ITEMS
     C           ENDDO
     D m_rtnString     S          65535A

         // Convert between upper/lower case.
         //  Default is to conver to UPPER case.
         //  0 = Convert to UPPER
         //  1 = Convert to lower

     P cvtCase         B                   EXPORT
     D cvtCase         PI         65535A   Varying
     D  inString                  65535A   Const Varying OPTIONS(*VARSIZE)
     D  option                       10I 0 Const OPTIONS(*NOPASS)

     D inStringLen     S             10I 0
     D frcb            DS                  LikeDS(FRCB_T)  Inz(*LIKEDS)
     D apiError        DS                  LikeDS(QUSEC_T) Inz(*LIKEDS)
      /free

           inStringLen = %Len(%trimR(inString));
           if (inStringLen < 1);
              return '';  // Nothing to do
           endif;

           if  (%parms >= 2);  // DFT(0=toUPPER) 1=tolower
               frcb.convertTo = option;
           else;
              reset frcb.convertTo;
           endif;

           QlgCvtCase(FRCB : inString : m_rtnString : inStringLen : apiError);

           return  %subst(m_rtnString : 1 : inStringLen);
      /end-free
     P cvtCase         E

     P cvtCaseEx       B                   Export
     D cvtCaseEx       PI
     D  inString                  65535A   Const Varying OPTIONS(*VARSIZE)
     D  outString                 65535A   OPTIONS(*VARSIZE)
     D  inStringLen                  10I 0 Const
     D  option                       10I 0 Const OPTIONS(*NOPASS)

     D frcb            DS                  LikeDS(FRCB_T)  Inz(*LIKEDS)
     D apiError        DS                  LikeDS(QUsec_T) Inz(*LIKEDS)
      /free
           //  QlgCvtCase uses 0 to convert to uppercase, and 1 to convert
           //  to lowercase. We use the named constants coz.TOUPPER and coz.TOLOWER
           //  which are passed into this procedure on the nOption parameter.
           //  The parameter value is copied to the FRCB.convertTo subfield.

           if (%Parms() >= 4 and %addr(option) <> *NULL);
              frcb.convertTo = option;
           else;
              reset frcb.convertTo;
           endif;

           if (inStringLen > 0);
              QlgCvtCase(FRCB : inString : outString: inStringLen: apiError);
           endif;
          return;
      /end-free
     P cvtCaseEx       E

     P makeLower       B                   Export
     D makeLower       PI                  OPDESC
     D  inString                  65535A   OPTIONS(*VARSIZE)

     D frcb            DS                  LikeDS(FRCB_T)  Inz(*LIKEDS)

     D inType          S             10I 0
     D inLen           S             10I 0
     D inMaxLen        S             10I 0
     D apiError        DS                  LikeDS(QUsec_T) Inz(*LIKEDS)
      /free
           //  QlgCvtCase uses 0 to convert to uppercase, and 1 to convert
           //  to lowercase. We use the named constants coz.TOUPPER and coz.TOLOWER
           //  which are passed into this procedure on the nOption parameter.
           //  The parameter value is copied to the FRCB.convertTo subfield.
           ceegsi(1 : inType : inLen  : inMaxLen: *OMIT);

           frcb.convertTo = coz.tolower;

           if (inLen > 0);
              QlgCvtCase(FRCB : inString : inString : inLen : apiError);
           endif;
          return;
      /end-free
     P makeLower       E

     P makeUpper       B                   Export
     D makeUpper       PI                  OPDESC
     D  inString                  65535A   OPTIONS(*VARSIZE)

     D frcb            DS                  LikeDS(FRCB_T)  Inz(*LIKEDS)

     D inType          S             10I 0
     D inLen           S             10I 0
     D inMaxLen        S             10I 0
     D apiError        DS                  LikeDS(QUsec_T) Inz(*LIKEDS)
      /free
           //  QlgCvtCase uses 0 to convert to uppercase, and 1 to convert
           //  to lowercase. We use the named constants coz.TOUPPER and coz.TOLOWER
           //  which are passed into this procedure on the nOption parameter.
           //  The parameter value is copied to the FRCB.convertTo subfield.
           ceegsi(1 : inType : inLen  : inMaxLen: *OMIT);

           frcb.convertTo = coz.toUpper;

           if (inLen > 0);
              QlgCvtCase(FRCB : inString : inString : inLen : apiError);
           endif;
          return;
      /end-free
     P makeUpper       E
**  SPR/MIN - Minimum Retail-sale-comm-amt
0020000990050000
0020000990050000
0020000990050000
** WPR/MSC - Minimum Wholesale
0004999990015000
0004999990015000
0004999990015000