<?php

namespace App\Repository;

use App\Entity\Main\Repertoire;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Repertoire>
 */
class RepertoireRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Repertoire::class);
    }

    // is the current position included or are all parent moves at some point excluded
    public function isIncluded(string $fenBefore): bool
    {
        $included = false;

        $res = $this->findBy(["FenBefore" => $fenBefore]);
        foreach ($res as $rec) {
            // if this move is included
            if (!$rec->isExclude()) {
                // if this is not the root position
                if ($rec->FenBefore() != $rec->FenAfter()) {
                    // check if one of the parent moves is included
                    $included = $this->isIncluded($rec->FenBefore());
                    if ($included) {
                        break;
                    }
                } else {
                    $included = true;
                    break;
                }
            }
        }

        return count($res) == 0 ? true : $included;
    }

    //    /**
    //     * @return Repertoire[] Returns an array of Repertoire objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('r')
    //            ->andWhere('r.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('r.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?Repertoire
    //    {
    //        return $this->createQueryBuilder('r')
    //            ->andWhere('r.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
