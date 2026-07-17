     H dftactgrp(*NO) ACTGRP(*NEW)
     d arr            S              10A   DIM(20) ASCEND
     d dumbReq        S              10A   inz('HONEY')
     D x              S              10I 0
     C                   EVAL      Arr = %LIST('SUGAR':'HONEY':'SYRUP':'CRAP')
     C                   Sorta     arr
     C                   EVAL      X = 1
     C     dumbReq       LOOKUP    arr(x)                             71
     C     dumbReq       LOOKUP    arr                                  72
     C     dumbReq       LOOKUP    arr                                    73
     C     dumbReq       LOOKUP    arr                                74  75
     C     dumbReq       LOOKUP    arr                                7677
     C     dumbReq       LOOKUP    arr                                  7779
