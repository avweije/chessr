<?php

namespace App\Repository;

use App\Entity\Main\ECO;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ECO>
 */
class ECORepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ECO::class);
    }

    public function findCode($pgn): null|array
    {
        $qb = $this->getEntityManager()->createQueryBuilder('ECO');
        $query = $qb->select('e')
            ->from('App\Entity\Main\ECO', 'e')
            ->where($qb->expr()->like(':pgn', 'CONCAT(e.PGN, \'%\')'))
            ->setParameter('pgn', $pgn)
            ->orderBy('e.PGN', 'DESC')
            ->setMaxResults(1)
            ->getQuery();

        $res = $query->getArrayResult();

        return count($res) > 0 ? ["code" => $res[0]["Code"], "name" => $res[0]["Name"]] : null;
    }

    public function hasMore($pgn): bool
    {
        $qb = $this->getEntityManager()->createQueryBuilder('ECO');
        $query = $qb->select('e')
            ->from('App\Entity\Main\ECO', 'e')
            ->where($qb->expr()->like('e.PGN', ':pgn'))
            ->setParameter('pgn', $pgn . ' %')
            ->orderBy('e.PGN', 'ASC')
            ->setMaxResults(1)
            ->getQuery();

        $res = $query->getArrayResult();

        return count($res) > 0;
    }

    public function findByPgn($pgn): array
    {
        // we use the number of spaces in the pgn to find the next moves
        $spaces = substr_count($pgn, ' ');
        // if it's white to move, we need to add an extra space
        if (($spaces + 1) % 3 == 0) {
            $spaces++;
        }

        // spaces, white to move: 0 (1), 3 (3), 6 (5), 9 (7)
        // spaces, black to move: 1 (2), 4 (4), 7 (6), 10 (8)
        $halfmove = ($spaces % 3 == 0) ? ($spaces / 3) * 2 + 1 : (($spaces - 1) / 3) * 2 + 2;

        // '1. e4 e5'
        // '1. e4 e5 2. a4'
        // '1. e4 e5 2. e4 e5'
        // '1. e4 e5 2. e4 e5 3. e4'
        // '1. e4 e5 2. e4 e5 3. e4 e5'

        // build the query
        $qb = $this->createQueryBuilder('ECO')
            ->andWhere('ECO.PGN LIKE \'' . $pgn . '%\'')
            ->andWhere('LENGTH(ECO.PGN) - LENGTH(REPLACE(ECO.PGN, \' \', \'\')) <= :spaces')
            ->setParameter('spaces', $spaces + 1)
            //->orderBy('LENGTH(ECO.PGN)', 'ASC')
            ->getQuery();

        $resp = array('current' => '', 'pgn' => $pgn, 'halfmove' => $halfmove, 'spaces' => $spaces, 'next' => []);

        foreach ($qb->getArrayResult() as $r) {
            if ($pgn == $r['PGN']) {
                $resp['current'] = ["code" => $r["Code"], "name" => $r["Name"]];
            } else {
                $resp['next'][] = $r;
            }
        }

        // if we have no current PGN
        if ($resp['current'] == '') {
            $curr = $this->findCodeByPgn($pgn);
            if ($curr) {
                $resp['current'] = ["code" => $curr["Code"], "name" => $curr["Name"]];
            }
        }

        return $resp;
    }

    // find the ECO code for a PGN string
    public function findCodeByPgn($pgn): ?array
    {
        $pgns = [];
        $moves = explode(" ", $pgn);

        // build up a new pgn string
        $str = "";
        for ($i = 0; $i < count($moves); $i++) {
            // add to the pgn string
            $str .= ($str == "" ? "" : " ") . $moves[$i];
            // if this is a move number
            if (preg_match('/^\\d+\\./', $moves[$i]) !== 1) {
                // add to the pgns
                $pgns[] = $str;
            }
        }

        //dd($pgns);

        // build the query
        $qb = $this->createQueryBuilder('ECO');
        $query = $qb->add('where', $qb->expr()->in('ECO.PGN', '?1'))
            ->setParameter('1', $pgns)
            ->orderBy('ECO.PGN', 'DESC')
            ->setMaxResults(1)
            ->getQuery();

        $res = $query->getArrayResult();

        return count($res) > 0 ? $res[0] : null;
    }

    //    /**
    //     * @return ECO[] Returns an array of ECO objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('e')
    //            ->andWhere('e.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('e.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?ECO
    //    {
    //        return $this->createQueryBuilder('e')
    //            ->andWhere('e.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
