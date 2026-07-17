     HBNDDIR('QC2LE')  OPTION(*NODEBUGIO : *SRCSTMT) DFTACTGRP(*NO) ACTGRP(*NEW)

     FDSPDTAQDF CF   E             WORKSTN INFDS(WSDS)

     D DspDtaQD        PR
     D  DtaQ                         20A

     D DspDtaQD        PI
     D  DtaQ                         20A

     D rtvDtaQD        PR                  Extpgm('QMHQRDQD')
     D  RtnVariable                2000A   OPTIONS(*VARSIZE)
     D  RtnVarLen                    10I 0 Const
     D  APIFMT                        8A   Const
     D  DTAQ                         20A   Const

     D wsds            DS
     D  FKey                          1A   Overlay(WSDS:369)

     D PSDS           SDS
     D  pgmName          *PROC
     D  CPFMSGID                      7A   Overlay(PSDS:40)
     D  CPFMSGD                      80A   Overlay(PSDS:91)
     D  MSGTEXT                      52A   Overlay(PSDS:91)

     D F3              C                   Const(X'33')
     D ENTER           C                   Const(X'F1')

     D TESTDESC        C                   Const('These are the times to +
     D                                     remember, cause they will not +
     D                                     last forever. These are the days +
     D                                     we''ll hold onto, but we won''t +
     D                                     although we''ll want to')

     D DQDataF1        DS                  Inz
     D  BytesRtn                     10I 0
     D  BytesAvail                   10I 0 Inz(%size(DQDataF1))
     D  Max_Len                      10I 0
     D  Key_Len                      10I 0
     D  Q_Seq                         1A
     D  Sender_ID                     1A
     D  Force_Write                   1A
     D  TextDesc                     50A
     D  DtaQ_Type                     1A
     D  Auto_Rcl                      1A
     D  Reserved1                     1A
     D  Cur_Msgs                     10I 0
     D  CurEntry_Cap                 10I 0
     D  DtaQName                     10A
     D  DtaQLib                      10A
     D  Max_Entry                    10I 0
     D  Init_Entry                   10I 0

     D DQDataF2        DS                  Inz
     D  BytesRtn2                    10I 0
     D  BytesAvail2                  10I 0 Inz(%size(DQDataF2))
     D  APPCDevD                     10A
     D  Mode_Name                     8A
     D  Rmt_Loc                       8A
     D  Lcl_Loc                       8A
     D  RmtNet_ID                     8A
     D  RmtDQName                    10A
     D  RmtDQLib                     10A
     D  DtaQName2                    10A
     D  DtaQLib2                     10A
     D QSYSDATE        S               D   Datfmt(*USA) Inz(*SYS)
     D QSYSTIME        S               T   Timfmt(*USA) Inz(*SYS)
     C                   MOVE      *ON           *INLR
